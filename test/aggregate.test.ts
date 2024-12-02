import { aggregate, many, one } from '../src/aggregate'
describe("aggregate", () => {
    it("should aggregate rows to themselves", () => {
        const rows = [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' }
        ]

        const result = aggregate(row => many(
            {
                id: row.id,
                name: row.name
            }, row.id
        ), rows)

        expect(result).toEqual(rows)
    })

    it("should aggregate rows with same id to one", () => {
        const rows = [
            { id: 1, name: 'a' },
            { id: 1, name: 'b' },
            { id: 1, name: 'c' },
        ]

        const result = aggregate(row => many(
            {
                id: row.id,
                name: row.name
            }, row.id
        ), rows)

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

        const result = aggregate(row => one({
            id: row.id,
            name: row.name,
        }, {
            friends: many(row.friend, row.friend)
        }), rows)
        expect(result).toEqual({
            id: 1,
            name: 'a',
            friends: ["a", "b", "c"]
        })
    })
})