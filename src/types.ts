import { AggregatedField, AggregatedValue, AggregatedValueMap } from "./values"

export type Relations = Record<string, AggregatedField<any, any>>

export type Key = string | number | symbol | object

type InferValueWithRelations<TValue> = TValue extends Record<any, any> ? { [K in keyof TValue]: Infer<TValue[K]> } : TValue

type InferFromDef<T extends AggregatedField<any, any>> = T extends AggregatedValue<any, infer TValue>
    ? InferValueWithRelations<TValue>
    : T extends AggregatedValueMap<any, infer TValue>
    ? Array<InferValueWithRelations<TValue>>
    : never

export type Infer<T> =
    T extends AggregatedField<any, any> ? InferFromDef<T> : T

export class AggregationConflictError extends Error {

}
