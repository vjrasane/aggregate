import { AggregationConflictError, Infer, Key } from "./types"

const isEqual = (a: any, b: any): boolean => {
    if (typeof a !== typeof b) return false
    if (typeof a === 'object') return Object.entries(a).every(([key, value]) => isEqual(value, b[key]))
    return a === b
}

const toString = (value: any): string => {
    if (typeof value === 'object') return JSON.stringify(value)
    return value
}

export abstract class AggregatedField<TKey extends Key, TValue> {
    abstract update(aggregator: AggregatedField<any, any>): AggregatedField<TKey, TValue>

    public abstract toValue(): Infer<TValue>
}


export class AggregatedValue<TKey extends Key, TValue> extends AggregatedField<TKey, TValue> {
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
            currentValue.update(fieldValue)
        })
    }

    toValue() {
        if (this.value == null) return this.value
        if (typeof this.value !== 'object') return this.value
        return Object.entries(this.value).reduce((acc, [fieldKey, fieldValue]) => {
            acc[fieldKey] = (fieldValue instanceof AggregatedField) ? fieldValue.toValue() : fieldValue
            return acc
        }, {} as Record<any, any>)
    }
}

export class AggregatedValueMap<TKey extends Key, TValue> extends AggregatedField<TKey, TValue> {
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
                currentValue.update(value)
                return
            }
            this.values[keyString] = value
        })
        return this
    }


    toValue(): Infer<TValue> {
        return Object.values(this.values).map((value) => value.toValue()) as Infer<TValue>
    }
}