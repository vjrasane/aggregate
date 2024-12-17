import { aggregate, AggregationConflictError, many, one } from '../src'
import hash from "object-hash"
import { AggregatedField } from '../src/values'
import { Field, Infer, InferValueWithRelations, ValueMap } from '../src/types'

describe("aggregate", () => {
    it("should return undefined for single value and empty rows", () => {
        const result = aggregate((row: any) => one(row.id, row.name), [])
        expect(result).toBeUndefined()
    })

    it("should return undefined for many values and empty rows", () => {
        const result = aggregate((row: any) => many(row.id, row.name), [])
        expect(result).toBeUndefined()
    })

    it("should return default value if rows are empty", () => {
        const result = aggregate((row: any) => one(row.id, row.name), [], "default value")
        expect(result).toBe("default value")
    })

    it("should throw error if aggregates mismatch", () => {
        const rows = [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' }
        ]

        expect(() => aggregate(
            row => row.id === 1 ? one(row.id, row.name) : many(row.id, row.name),
            rows
        )).toThrow(AggregationConflictError)
    })

    it("should throw error if ids mismatch", () => {
        const rows = [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' }
        ]

        expect(() => aggregate(
            row => one(row.id, row.name),
            rows
        )).toThrow(AggregationConflictError)
    })

    it("should aggregate rows to themselves", () => {
        const rows = [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' }
        ]

        const result = aggregate(row => many(
            row.id,
            {
                id: row.id,
                name: row.name
            }
        ), rows)

        expect(result).toEqual(rows)
    })

    it("should aggregate single value", () => {
        const rows = { id: 1, name: 'a' }

        const result = aggregate(row => one(
            row.id,
            {
                id: row.id,
                name: row.name
            }
        ), rows)

        expect(result).toEqual(rows)
    })

    it("should return null for null", () => {
        const result = aggregate((row: any) => one(row, row), null)
        expect(result).toBe(null)
    })


    it("should return undefined for undefined", () => {
        const result = aggregate((row: any) => one(row, row), undefined)
        expect(result).toBe(undefined)
    })

    it("should return undefined for undefined rows", () => {
        const result = aggregate((row: any) => one(row, row), [undefined, undefined, undefined])
        expect(result).toBe(undefined)
    })

    it("should return null for null rows", () => {
        const result = aggregate((row: any) => one(row, row), [null, null, null])
        expect(result).toBe(null)
    })

    it("should aggregate rows with same id to one", () => {
        const rows = [
            { id: 1, name: 'a' },
            { id: 1, name: 'b' },
            { id: 1, name: 'c' },
        ]
        type TRow = typeof rows[0]
        const f = (row: TRow) => many(
            row.id,
            {
                id: row.id,
                name: row.name
            }
        )
        type A = Infer<ReturnType<typeof f>>
        type B = ReturnType<typeof f> extends ValueMap<infer TValue> ? InferValueWithRelations<TValue> : false

        const result = aggregate(f, rows)


        expect(result).toEqual([{
            id: 1,
            name: "a"
        }])
    })

    it("should aggregate nested values", () => {
        const rows = [
            { id: 1, name: 'a', friend: "a" },
            { id: 1, name: 'a', friend: "b" },
            { id: 1, name: 'a', friend: "c" }
        ]

        const result = aggregate(row => one(row.id, {
            id: row.id,
            name: row.name,
            friends: many(row.friend, row.friend)
        }), rows)
        expect(result).toEqual({
            id: 1,
            name: 'a',
            friends: ["a", "b", "c"]
        })
    })


    it("should aggregate deeply nested values", () => {
        const rows = [
            { id: 1, name: 'a', friendId: 1, petId: 1, petName: 'dog' },
            { id: 1, name: 'a', friendId: 1, petId: 2, petName: 'cat' },
            { id: 1, name: 'a', friendId: 2, petId: 3, petName: 'fish' },
            { id: 2, name: 'b', friendId: 3, petId: 4, petName: 'bird' },
            { id: 2, name: 'b', friendId: 4, petId: 5, petName: 'horse' },
            { id: 2, name: 'b', friendId: 5, petId: 6, petName: 'cow' },
            { id: 2, name: 'b', friendId: 5, petId: 7, petName: 'chicken' },
        ]

        const result = aggregate(row => many(row.id, {
            id: row.id,
            name: row.name,
            friends: many(row.friendId, {
                id: row.friendId,
                pets: many(row.petId, {
                    id: row.petId,
                    name: row.petName
                })
            })
        }), rows)
        expect(result).toEqual([
            {
                id: 1,
                name: 'a',
                friends: [
                    {
                        id: 1,
                        pets: [
                            { id: 1, name: 'dog' },
                            { id: 2, name: 'cat' }
                        ]
                    },
                    {
                        id: 2,
                        pets: [
                            { id: 3, name: 'fish' }
                        ]
                    }
                ]
            },
            {
                id: 2,
                name: 'b',
                friends: [
                    {
                        id: 3,
                        pets: [
                            { id: 4, name: 'bird' }
                        ]
                    },
                    {
                        id: 4,
                        pets: [
                            { id: 5, name: 'horse' }
                        ]
                    },
                    {
                        id: 5,
                        pets: [
                            { id: 6, name: 'cow' },
                            { id: 7, name: 'chicken' }
                        ]
                    }
                ]
            }
        ])
    })
    it("should aggregate rows with composite keys using array key", () => {
        const rows = [
            { name: 'a', role: "user", message: "hello" },
            { name: 'a', role: "user", message: "world!" },
            { name: 'b', role: 'user', message: "my" },
            { name: 'b', role: 'user', message: "message" },
            { name: 'b', role: 'admin', message: "please" },
            { name: 'b', role: 'admin', message: "recycle" },
        ]

        const result = aggregate(row => many(
            [row.name, row.role],
            {
                name: row.name,
                role: row.role,
                messages: many(row.message, row.message)
            }
        ), rows)

        expect(result).toEqual([
            {
                name: 'a',
                role: 'user',
                messages: ["hello", "world!"]
            },
            {
                name: 'b',
                role: 'user',
                messages: ["my", "message"]
            },
            {
                name: 'b',
                role: 'admin',
                messages: ["please", "recycle"]
            }
        ])
    })
    it("should aggregate rows with composite keys using object key", () => {
        const rows = [
            { name: 'a', role: "user", message: "hello" },
            { name: 'a', role: "user", message: "world!" },
            { name: 'b', role: 'user', message: "my" },
            { name: 'b', role: 'user', message: "message" },
            { name: 'b', role: 'admin', message: "please" },
            { name: 'b', role: 'admin', message: "recycle" },
        ]

        const result = aggregate(row => many(
            { name: row.name, role: row.role },
            {
                name: row.name,
                role: row.role,
                messages: many(row.message, row.message)
            }
        ), rows)

        expect(result).toEqual([
            {
                name: 'a',
                role: 'user',
                messages: ["hello", "world!"]
            },
            {
                name: 'b',
                role: 'user',
                messages: ["my", "message"]
            },
            {
                name: 'b',
                role: 'admin',
                messages: ["please", "recycle"]
            }
        ])
    })

    it("should aggregate rows with composite keys using JSON stringify", () => {
        const rows = [
            { name: 'a', role: "user", message: "hello" },
            { name: 'a', role: "user", message: "world!" },
            { name: 'b', role: 'user', message: "my" },
            { name: 'b', role: 'user', message: "message" },
            { name: 'b', role: 'admin', message: "please" },
            { name: 'b', role: 'admin', message: "recycle" },
        ]

        const result = aggregate(row => many(
            JSON.stringify({ name: row.name, role: row.role }),
            {
                name: row.name,
                role: row.role,
                messages: many(row.message, row.message)
            }
        ), rows)

        expect(result).toEqual([
            {
                name: 'a',
                role: 'user',
                messages: ["hello", "world!"]
            },
            {
                name: 'b',
                role: 'user',
                messages: ["my", "message"]
            },
            {
                name: 'b',
                role: 'admin',
                messages: ["please", "recycle"]
            }
        ])
    })

    it("should aggregate rows with composite keys using object hash", () => {
        const rows = [
            { name: 'a', role: "user", message: "hello" },
            { name: 'a', role: "user", message: "world!" },
            { name: 'b', role: 'user', message: "my" },
            { name: 'b', role: 'user', message: "message" },
            { name: 'b', role: 'admin', message: "please" },
            { name: 'b', role: 'admin', message: "recycle" },
        ]

        const result = aggregate(row => many(
            hash({ name: row.name, role: row.role }),
            {
                name: row.name,
                role: row.role,
                messages: many(row.message, row.message)
            }
        ), rows)

        expect(result).toEqual([
            {
                name: 'a',
                role: 'user',
                messages: ["hello", "world!"]
            },
            {
                name: 'b',
                role: 'user',
                messages: ["my", "message"]
            },
            {
                name: 'b',
                role: 'admin',
                messages: ["please", "recycle"]
            }
        ])
    })

    it("should not expose internals", () => {
        /* @ts-expect-error */
        many(1, 1).update(many(1, 1))
        /* @ts-expect-error */
        many(1, 1).toValue(many(1, 1))

        /* @ts-expect-error */
        one(1, 1).update(one(1, 1))
        /* @ts-expect-error */
        one(1, 1).toValue(one(1, 1))

        expect(true).toBe(true)
    })
})