import { AggregatedField } from "./values"

export type Relations = Record<string, AggregatedField<any, any>>

export type Key = string | number | symbol | object


export type InferDeep<TValue> = TValue extends Record<any, any>
    ? { [K in keyof TValue]:
        Infer<TValue[K]>
    }
    : TValue

type InferFromDef<T extends Arity<any, any>> = T extends One<infer TValue, any>
    ? InferDeep<TValue>
    : T extends Many<infer TValue, any>
    ? InferDeep<TValue>[]
    : never

type InferFrom<T> = T extends Arity<any, infer O> ?
    (O extends unknown ? InferFromDef<T> : O) :
    never

export type Infer<T> =
    T extends Arity<any, any>
    ? InferFrom<T> : InferDeep<T>

export class AggregationConflictError extends Error {

}

interface IArity<TValue, TOutput> {
    map: <TMapped>(fn: (value: TOutput) => TMapped) => IArity<TValue, TMapped>
}


interface One<TValue, TOutput> extends IArity<TValue, TOutput> {
    kind: "one"
    map: <TMapped>(fn: (value: TOutput) => TMapped) => One<TValue, TMapped>
}

interface Many<TValue, TOutput> extends IArity<TValue, TOutput> {
    kind: "many"
    map: <TMapped>(fn: (value: TOutput) => TMapped) => Many<TValue, TMapped>
}

export type Arity<TValue, TOutput> = One<TValue, TOutput> | Many<TValue, TOutput>

export abstract class Internal<TValue, TOutput> implements IArity<TValue, TOutput> {
    abstract map<TMapped>(fn: (value: TOutput) => TMapped): IArity<TValue, TMapped>
    abstract update(aggregator: Internal<any, any>): Internal<TValue, TOutput>
    abstract toValue(): TOutput | TOutput[]
}

const isEqual = (a: any, b: any): boolean => {
    if (typeof a !== typeof b) return false
    if (a == null) return a === b
    if (typeof a === 'object') return Object.entries(a).every(([key, value]) => isEqual(value, b[key]))
    return a === b
}

const toString = (value: any): string => {
    if (typeof value === 'object') return JSON.stringify(value)
    return value
}

const toValue = <TValue>(value: TValue): Infer<TValue> => {
    if (value == null) return value as Infer<TValue>
    if (typeof value !== 'object') return value as Infer<TValue>
    const result = Object.entries(value).reduce((acc, [fieldKey, fieldValue]) => {
        acc[fieldKey] = (fieldValue instanceof Internal) ? fieldValue.toValue() : fieldValue
        return acc
    }, {} as Record<any, any>)
    return result as Infer<TValue>
}


export class OneInternal<TValue, TOutput> extends Internal<TValue, TOutput> implements One<TValue, TOutput> {
    readonly kind = "one"
    constructor(readonly id: any, readonly value: any, readonly transform: (value: Infer<TValue>) => TOutput) {
        super()
    }

    update(aggregator: Internal<any, any>): OneInternal<TValue, TOutput> {
        if (!(aggregator instanceof OneInternal))
            throw new AggregationConflictError(`Expected ${this.constructor.name}, got ${aggregator.constructor.name}`)
        if (!isEqual(this.id, aggregator.id))
            throw new AggregationConflictError(`Found multiple results with differing ids: ${toString(this.id)} and ${toString(aggregator.id)}`)
        this.updateRelations(aggregator.value)
        return this
    }

    map<TMapped>(fn: (value: TOutput) => TMapped): OneInternal<TValue, TMapped> {
        return new OneInternal(this.id, this.value, v => fn(this.transform(v)))
    }

    private updateRelations = (value: any) => {
        if (this.value == null) return
        if (typeof this.value !== 'object') return
        Object.entries(value).forEach(([fieldKey, fieldValue]) => {
            if (!(fieldValue instanceof Internal)) return // TODO: check equality?
            const currentValue = this.value[fieldKey as string]
            if (currentValue == null) {
                this.value[fieldKey] = fieldValue
                return
            }
            if (!(currentValue instanceof Internal))
                throw new AggregationConflictError(`Attempted to update relation of type ${typeof currentValue}`)
            currentValue.update(fieldValue)
        })
    }

    toValue(): TOutput {
        const transformed = this.transform(this.value)
        return transformed
    }
}

export class ManyInternal<TValue, TOutput> extends Internal<TValue, TOutput> implements Many<TValue, TOutput> {
    readonly kind = "many"

    constructor(
        readonly values: Record<any, OneInternal<TValue, Infer<TValue>>>,
        readonly transform: (value: Infer<TValue>[]) => TOutput[]
    ) {
        super()
    }

    static fromValue<TValue>(key: any, value: TValue): ManyInternal<TValue, Infer<TValue>> {
        return new ManyInternal({
            [toString(key)]: new OneInternal(key, value, v => v)
        }, v => v)
    }

    map<TMapped>(fn: (value: TOutput) => TMapped): ManyInternal<TValue, TMapped> {
        return new ManyInternal<TValue, TMapped>(this.values, (values) => this.transform(values).map(fn))
    }

    update(aggregator: Internal<any, any>): Internal<TValue, TOutput> {
        if (!(aggregator instanceof ManyInternal))
            throw new AggregationConflictError(`Expected ${this.constructor.name}, got ${aggregator.constructor.name}`)
        Object.entries(aggregator.values).forEach(([key, value]) => {
            const keyString = toString(key)
            const currentValue = this.values[keyString]
            if (currentValue != null) {
                currentValue.update(value)
                return
            }
            this.values[keyString] = value
        })
        return this
    }

    toValue(): TOutput[] {
        const result = Object.values(this.values).map((value) => value.toValue())
        const transformed = this.transform(result)
        return transformed
    }
}





const one = <TValue>(key: any, value: TValue): One<TValue, Infer<TValue>> => new OneInternal<TValue, Infer<TValue>>(key, value, v => v)

const many = <TValue>(key: any, value: TValue): Many<TValue, Infer<TValue>> => ManyInternal.fromValue(key, value)
// class MappedInternal<TValue, TOutput, TMapped> extends Internal<TValue, TMapped> {
//     kind: "mapped"
// }

// class OneInternal<TValue, TOutput> extends Internal<TValue, TOutput> implements One<TValue, TOutput> {
//     kind: "one"

//     constructor(private key: any, private value: TValue) {
//         super()
//     }

//     map<TMapped>(fn: (value: TOutput) => TMapped): MappedInternal<TValue, TOutput, TMapped> {
//         throw new Error('Not implemented')
//     }

//     toValue(): TOutput {
//         throw new Error('Not implemented')
//     }
// }



const result = one(1, { name: 'Alice', age: many(39, 1).map(v => "hello" + v) })

