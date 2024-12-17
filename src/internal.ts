import { AggregationConflictError, IArity, Infer, Many, One } from "./types"

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
export abstract class Internal<TOutput> implements IArity<TOutput> {
    abstract map<TMapped>(fn: (value: TOutput) => TMapped): IArity<TMapped>
    abstract update(aggregator: Internal<any>): Internal<TOutput>
    abstract toValue(): TOutput | TOutput[]
}
export class OneInternal<TOutput> extends Internal<TOutput> implements One<TOutput> {
    readonly kind = "one"
    constructor(readonly id: any, readonly value: any, readonly transform: (value: any) => TOutput) {
        super()
    }

    update(aggregator: Internal<any>): OneInternal<TOutput> {
        if (!(aggregator instanceof OneInternal))
            throw new AggregationConflictError(`Expected ${this.constructor.name}, got ${aggregator.constructor.name}`)
        if (!isEqual(this.id, aggregator.id))
            throw new AggregationConflictError(`Found multiple results with differing ids: ${toString(this.id)} and ${toString(aggregator.id)}`)
        this.updateRelations(aggregator.value)
        return this
    }

    map<TMapped>(fn: (value: TOutput) => TMapped): OneInternal<TMapped> {
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
        if (this.value == null) return this.value
        if (typeof this.value !== 'object') return this.value
        const result = Object.entries(this.value).reduce((acc, [fieldKey, fieldValue]) => {
            acc[fieldKey] = (fieldValue instanceof Internal) ? fieldValue.toValue() : fieldValue
            return acc
        }, {} as Record<any, any>)
        const transformed = this.transform(result)
        return transformed
    }
}

export class ManyInternal<TOutput> extends Internal<TOutput> implements Many<TOutput> {
    readonly kind = "many"

    constructor(
        readonly values: Record<any, OneInternal<any>>,
        readonly transform: (value: any[]) => TOutput[]
    ) {
        super()
    }

    static fromValue<TValue>(key: any, value: TValue): ManyInternal<Infer<TValue>> {
        return new ManyInternal({
            [toString(key)]: new OneInternal(key, value, v => v)
        }, v => v)
    }

    map<TMapped>(fn: (value: TOutput) => TMapped): ManyInternal<TMapped> {
        return new ManyInternal<TMapped>(this.values, (values) => this.transform(values).map(fn))
    }

    update(aggregator: Internal<any>): Internal<TOutput> {
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

