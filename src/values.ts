import { AggregationConflictError, Infer, Key, Value, ValueMap } from "./types"

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


export abstract class AggregatedField<TKey extends Key = any, TValue = any> {
    // abstract update(aggregator: AggregatedField<any, any>): AggregatedField<TKey, TValue>

    // abstract toValue(): Infer<TValue>
}

export const update = (first: AggregatedField, second: AggregatedField): AggregatedField => {
    if (first instanceof AggregatedValue) return first.update(second)
    if (first instanceof AggregatedValueMap) return first.update(second)
    throw new AggregationConflictError(`Cannot update ${first.constructor.name} with ${second.constructor.name}`)
}

export const toValue = <TValue>(field: AggregatedField<any, TValue>): Infer<TValue> => {
    if (field instanceof AggregatedValue) return field.toValue()
    if (field instanceof AggregatedValueMap) return field.toValue() as Infer<TValue>
    throw new AggregationConflictError(`Cannot convert ${field.constructor.name} to value`)
}

export class AggregatedValue<TKey extends Key, TValue> extends AggregatedField<TKey, TValue> implements Value<TValue> {
    readonly id: any
    readonly value: any

    constructor(id: TKey, value: TValue) {
        super()
        this.id = id
        this.value = value
    }

    update(aggregator: AggregatedField<any, any>): AggregatedField<TKey, TValue> {
        if (!(aggregator instanceof AggregatedValue))
            throw new AggregationConflictError(`Expected ${this.constructor.name}, got ${aggregator.constructor.name}`)
        if (!isEqual(this.id, aggregator.id))
            throw new AggregationConflictError(`Found multiple results with differing ids: ${toString(this.id)} and ${toString(aggregator.id)}`)
        this.updateRelations(aggregator.value)
        return this
    }

    private updateRelations = (value: any) => {
        if (this.value == null) return
        if (typeof this.value !== 'object') return
        Object.entries(value).forEach(([fieldKey, fieldValue]) => {
            if (!(fieldValue instanceof AggregatedField)) return // TODO: check equality?
            const currentValue = this.value[fieldKey]
            if (currentValue == null) {
                this.value[fieldKey] = fieldValue
                return
            }
            if (!(currentValue instanceof AggregatedField))
                throw new AggregationConflictError(`Attempted to update relation of type ${typeof currentValue}`)
            update(currentValue, fieldValue)
        })
    }

    toValue() {
        if (this.value == null) return this.value
        if (typeof this.value !== 'object') return this.value
        return Object.entries(this.value).reduce((acc, [fieldKey, fieldValue]) => {
            acc[fieldKey] = (fieldValue instanceof AggregatedField) ? toValue(fieldValue) : fieldValue
            return acc
        }, {} as Record<any, any>)
    }
}

export class AggregatedValueMap<TKey extends Key, TValue> extends AggregatedField<TKey, TValue> implements ValueMap<TValue> {
    values: Record<any, AggregatedField<any, TValue>> = {}

    constructor(key: TKey, value: TValue) {
        super()
        this.values[toString(key)] = new AggregatedValue(key, value)
    }

    update(aggregator: AggregatedField<any, any>): AggregatedField<TKey, TValue> {
        if (!(aggregator instanceof AggregatedValueMap))
            throw new AggregationConflictError(`Expected ${this.constructor.name}, got ${aggregator.constructor.name}`)
        Object.entries(aggregator.values).forEach(([key, value]) => {
            const keyString = toString(key)
            const currentValue = this.values[keyString]
            if (currentValue != null) {
                update(currentValue, value)
                return
            }
            this.values[keyString] = value
        })
        return this
    }


    toValue() {
        return Object.values(this.values).map(toValue)
    }
}


type One<TValue, TOutput> = {
    kind: 'value'
    key: any
    value: TValue
    toValue: () => TOutput
}

type Many<TValue, TOutput> = {
    kind: 'multi'
    value: Record<any, TValue>,
    toValue: () => TOutput[]
}

const one = <TValue>(key: any, value: TValue): One<TValue, Infer<TValue>> => {
    return {
        kind: 'value',
        key,
        value,
        toValue: () => {
            throw new Error('Not implemented')
        }
    }
}

const rows = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 40 },
    { id: 3, name: 'Charlie', age: 50 }
]

const result = one(1, { name: 'Alice', age: 30 })