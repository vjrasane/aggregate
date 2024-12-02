export type Relations = Record<string, AggregateDef<any, any>>

export type Key = string | number | symbol

export type Dictionary = Record<Key, any>

export interface MultipleEntityDef<TValue, TKey, TRelations extends Relations> {
    type: 'multiple',
    value: TValue,
    key: TKey,
    relations: TRelations
}

export interface SingleEntityDef<TValue, TRelations extends Relations> {
    type: 'single',
    value: TValue,
    relations: TRelations
}


export type AggregateDef<TValue, TRelations extends Relations> = SingleEntityDef<TValue, TRelations> | MultipleEntityDef<TValue, any, TRelations>

type InferValueWithRelations<TValue, TRelations extends Relations> = TValue extends Dictionary ?
    {} extends TRelations ? { [K in keyof TValue]: Infer<TValue[K]> } :
    { [K in keyof TValue]: Infer<TValue[K]> } & { [K in keyof TRelations]: Infer<TRelations[K]> } :
    TValue

type InferFromDef<T extends AggregateDef<any, any>> = T extends SingleEntityDef<infer TValue, infer TRelations>
    ? InferValueWithRelations<TValue, TRelations>
    : T extends MultipleEntityDef<infer TValue, any, infer TRelations>
    ? Array<InferValueWithRelations<TValue, TRelations>>
    : never

export type Infer<T> =
    T extends AggregateDef<any, any> ? InferFromDef<T> : T


interface AggregatedField {
    update(aggregator: AggregateDef<any, any>): AggregatedField

    toValue(): any
}

export class RootAggregatedValue implements AggregatedField {
    update(aggregator: AggregateDef<any, any>): AggregatedField {
        switch (aggregator.type) {
            case 'single':
                return new AggregatedValue(aggregator.value, aggregator.relations)
            case 'multiple':
                return new AggregatedValueMap(aggregator.value, aggregator.key, aggregator.relations)
            default:
                return this
        }
    }

    toValue() {
        return undefined
    }
}

class AggregatedValue implements AggregatedField {
    readonly value: any
    readonly relations: Record<Key, AggregatedField> = {}

    constructor(value: any, relations: Relations) {
        this.value = value
        this.updateRelations(relations)
    }

    update(aggregator: AggregateDef<any, any>): AggregatedField {
        if (aggregator.type !== "single") return this
        this.updateRelations(aggregator.relations)
        return this
    }

    updateRelations = (relations: Relations) => {
        if (this.value == null) return
        if (typeof this.value !== 'object') return
        Object.entries(relations).forEach(([key, relation]) => {
            const relationValue = this.relations[key as Key]
            if (relationValue != null) {
                relationValue.update(relation)
                return
            }
            const newRelationValue = new RootAggregatedValue().update(relation)
            this.relations[key as Key] = newRelationValue
        })
    }

    toValue() {
        if (this.value == null) return this.value
        if (typeof this.value !== 'object') return this.value
        return {
            ...this.value,
            ...Object.entries(this.relations).reduce((acc, [key, relation]) => {
                acc[key as Key] = relation.toValue()
                return acc
            }, {} as Record<Key, any>)
        }
    }
}

class AggregatedValueMap implements AggregatedField {
    values: Record<any, AggregatedValue> = {}

    constructor(value: any, key: any, relations: Relations) {
        this.values[key] = new AggregatedValue(value, relations)
    }

    update(aggregator: AggregateDef<any, any>): AggregatedField {
        if (aggregator.type !== "multiple") return this

        const value = this.values[aggregator.key]
        if (value != null) {
            value.updateRelations(aggregator.relations)
            return this
        }
        if (aggregator.value == null) return this
        this.values[aggregator.key] = new AggregatedValue(aggregator.value, aggregator.relations)
        return this
    }

    toValue() {
        return Object.values(this.values).map((value) => value.toValue())
    }
}