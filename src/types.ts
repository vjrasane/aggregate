export type Key = string | number | symbol | object

export type InferDeep<TValue> = TValue extends Record<any, any>
    ? { [K in keyof TValue]:
        Infer<TValue[K]>
    }
    : TValue

type InferFromDef<T extends Arity<any>> = T extends One<infer TValue>
    ? InferDeep<TValue>
    : T extends Many<infer TValue>
    ? InferDeep<TValue>[]
    : never

export type Infer<T> =
    T extends Arity<any>
    ? InferFromDef<T> : InferDeep<T>

export class AggregationConflictError extends Error {

}

export interface IArity<TOutput> {
    map: <TMapped>(fn: (value: TOutput) => TMapped) => IArity<TMapped>
}


export interface One<TOutput> extends IArity<TOutput> {
    kind: "one"
    map: <TMapped>(fn: (value: TOutput) => TMapped) => One<TMapped>
}

export interface Many<TOutput> extends IArity<TOutput> {
    kind: "many"
    map: <TMapped>(fn: (value: TOutput) => TMapped) => Many<TMapped>
}

export type Arity<TOutput> = One<TOutput> | Many<TOutput>
