import { Infer, Key } from "./types"
import { AggregatedField, AggregatedValue, AggregatedValueMap } from "./values"
export { AggregationConflictError } from "./types"

export const one = <TKey extends Key, TValue>(id: TKey, value: TValue): AggregatedValue<TKey, TValue> => {
    return new AggregatedValue(id, value)
}

export const many = <TKey extends Key, TValue>(id: TKey, value: TValue): AggregatedValueMap<TKey, TValue> => {
    return new AggregatedValueMap(id, value)
}

interface Aggregate {
    <TData, TDef extends AggregatedField<any, any>, TDefault>(accessor: (row: TData) => TDef, data: TData | TData[], defaultValue: TDefault): Infer<TDef> | TDefault
    <TData, TDef extends AggregatedField<any, any>>(accessor: (row: TData) => TDef, data: TData | TData[]): Infer<TDef> | undefined
}

export const aggregate: Aggregate = (...args: any[]) => {
    const [accessor, data, defaultValue] = args
    const rows = Array.isArray(data) ? data : [data]
    if (!rows.length) return defaultValue
    const result = rows.reduce(
        (acc: AggregatedField<any, any> | undefined, row) =>
            acc == null
                ? accessor(row)
                : acc.update(accessor(row)),
        undefined)
        ?.toValue()
    return result
}
