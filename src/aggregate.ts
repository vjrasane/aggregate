import { AggregateDef, Dictionary, Infer, Key, MultipleEntityDef, Relations, RootAggregatedValue, SingleEntityDef } from "./types"

interface One {
    <TValue extends Dictionary, TRelations extends Relations>(value: TValue, relations: TRelations): SingleEntityDef<TValue, TRelations>
    <TValue>(value: TValue): SingleEntityDef<TValue, {}>
}

export const one: One = (...args: any[]) => {
    const [value, relations = {}] = args
    return {
        type: 'single' as const,
        value,
        relations
    }
}

interface Many {
    <TValue, TKey extends Key, TRelations extends Relations>(value: TValue, key: TKey, relations: TRelations): MultipleEntityDef<TValue, TKey, TRelations>
    <TValue, TKey>(value: TValue, key: TKey): MultipleEntityDef<TValue, TKey, {}>
}

export const many: Many = (...args: any[]) => {
    const [value, key, relations = {}] = args
    return {
        type: 'multiple' as const,
        value,
        key,
        relations
    }
}



export const aggregate = <TRow, TDef extends AggregateDef<any, any>>(accessor: (row: TRow) => TDef, rows: TRow[]): Infer<TDef> => {
    return rows.reduce((acc, row) => acc.update(accessor(row)), new RootAggregatedValue()).toValue()
}
