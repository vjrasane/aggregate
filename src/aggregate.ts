import { Field, Infer, Key, Value, ValueMap } from "./types"
import { AggregatedField, AggregatedValue, AggregatedValueMap, toValue, update } from "./values"
export { AggregationConflictError } from "./types"

export const one = <TKey extends Key, TValue>(id: TKey, value: TValue): Field<TValue> => {
    return new AggregatedValue(id, value)
}

export const many = <TKey extends Key, TValue>(id: TKey, value: TValue): Field<TValue> => {
    return new AggregatedValueMap(id, value)
}

interface Aggregate {
    <TData, TDef extends Field<any>, TDefault>(accessor: (row: TData) => TDef, data: TData | TData[], defaultValue: TDefault): Infer<TDef> | TDefault
    <TData, TDef extends Field<any>>(accessor: (row: TData) => TDef, data: TData[]): Infer<TDef>
    // <TData, TDef extends AggregatedField>(accessor: (row: TData) => TDef, data: TData): Infer<TDef> | undefined
}

export const aggregate: Aggregate = (...args: any[]) => {
    const [accessor, data, defaultValue] = args
    const rows = Array.isArray(data) ? data : [data]
    if (!rows.length) return defaultValue
    const result: AggregatedField | undefined = rows.reduce(
        (acc: AggregatedField | undefined, row) =>
            acc == null
                ? accessor(row)
                : update(acc, accessor(row)),
        undefined)
    if (result == null) return result
    return toValue(result)
}
