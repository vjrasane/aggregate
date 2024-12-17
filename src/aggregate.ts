import { Internal, ManyInternal, OneInternal } from "./internal"
import { Arity, Infer, Many, One } from "./types"
export { AggregationConflictError } from "./types"


export const one = <TValue>(key: any, value: TValue): One<Infer<TValue>> => new OneInternal(key, value, v => v)

export const many = <TValue>(key: any, value: TValue): Many<Infer<TValue>> => ManyInternal.fromValue(key, value)

interface Aggregate {
    <TData, TDef extends Arity<any>, TDefault>(accessor: (row: TData) => TDef, data: TData | TData[], defaultValue: TDefault): Infer<TDef> | TDefault
    <TData, TDef extends Arity<any>>(accessor: (row: TData) => TDef, data: TData | TData[]): Infer<TDef> | undefined
}

export const aggregate: Aggregate = (...args: any[]) => {
    const [accessor, data, defaultValue] = args
    const rows = Array.isArray(data) ? data : [data]
    if (!rows.length) return defaultValue
    const result: Internal<any> | undefined = rows.reduce(
        (acc: Internal<any> | undefined, row) =>
            acc == null
                ? accessor(row)
                : acc.update(accessor(row)),
        undefined)
    if (result == null) return result
    return result.toValue()
}
