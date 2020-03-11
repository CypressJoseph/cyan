import cyan from ".";
import { Cyan } from "./Cyan";

type State = {
    a: string,
    fn: () => boolean,
    obj: { attr: number },
    hello: { there?: { world?: string } },
}

describe("Cyan", () => {
    describe("walkthrough", () => {
        describe('examples', () => {
            it('docs', () => {
                cyan.expect(2 + 2).toBe(4)
                cyan.expect(2 + 2).not.toBe(5)

                cyan.wrap({ my: { value: 'here' } })
                    .glom('my', 'value')
                    .expect().toBe('here')

                // unwrap without a subject is an error
                expect(() => cyan.unwrap()).toThrow()

            })

            it('readme', () => {
                cyan.expect({ a: { b: 3 } }).glom('a', 'b').apply(x => x * x).toBe(9)
            })
        })
    });

    let state: State = {
        a: 'value',
        fn: () => true,
        obj: { attr: 123 },
        hello: { there: { world: 'hi' } },
    }

    let model: Cyan.Box<State> = cyan.wrap(state);

    describe("Expect", () => {
        it('is integrated into link', () => {
            model.expect('a').toBe('value')
            model.expect().its('a').toBe('value')
            model.its('a').expect().toBe('value')
            model.expect().glom('a').toBe('value')
            model.glom('a').expect().toBe('value')
            model.expect().glom('hello', 'there').toBe({world: 'hi'})
        })

        it('throws on error', () => {
            expect(
                () => model.expect('a').toBe('not-value')
            ).toThrow()
            // done()
        });

        it('throw on empty expect', () => {
            expect(
                () => cyan.expect()
            ).toThrow() // EmptyExpect
        })

    })

    describe("Box", () => {
        it('wrap/unwrap', () => {
            expect(
                cyan.wrap("hello").unwrap()
            ).toBe("hello")

            expect(
                cyan.wrap(123).unwrap()
            ).toBe(123)
        })

        it('accesses a property', () => {
            model.expect('a').toBe('value')
            model.expect('a').not.toBe('not-value')
            model.expect().its('a').not.toBe('not-value')
        })

        it('deep accesses a property', () => {
            model.glom('obj', 'attr').expect().toBe(123)
            let path: string[] = ['hello', 'there', 'world']
            model.expect().glom('hello', 'there', 'world').toBe('hi')
            model.glom(...path).expect().toBe('hi')
            state.hello = {}
            model.expect().glom('hello', 'there', 'world').toBe(undefined)
            model.glom(...path).expect().toBe(undefined)
        })

        // test.todo('deep access by path notation (sacrificing type-safety...)')

        it('invokes a method', () => {
            model.invokes('fn').expect().toBe(true)
            cyan.wrap(2+2).invokes('valueOf').expect().toBe(4)
            cyan.wrap(2+2).invokes('toString').expect().toBe('4')
        })

        it('applies a function', () => {
            cyan.wrap(2+2).apply(x => x*x).expect().toBe(16)
            model.its('a').apply((str) => str.length).expect().toBe(5)
        })

        it('each/map', () => {
            cyan.wrap([1,2,3])
                .each((x: number) => x*2)
                .expect().toBe([2,4,6])

            cyan.wrap([1, 2, 3])
                .map((x: number) => x*2)
                .expect().toBe([2,4,6])
        })

        it('index with its', () => {
            cyan.wrap([5,10,15]).expect(0).toBe(5)
            cyan.wrap([5,10,15]).expect(1).toBe(10)
        })

        it('filter', () => {
            cyan.wrap([1,2,3])
                .filter((x: number) => x > 2)
                .expect().its(0).toBe(3)
        })
    })

    describe("retrying", () => {
        it('retries promise-based assertions until they pass or timeout', async done => {
            let promiseTwo: Promise<number> = new Promise((resolve, reject) => {
                setTimeout(() => {
                    console.log("RESOLVING PROMISE")
                    resolve(2)
                }, 2000)
            })
            let promiseThree: Promise<number> = new Promise((resolve, reject) => {
                setTimeout(() => {
                    console.log("RESOLVING PROMISE")
                    resolve(3)
                }, 1000)
            })

            console.log("EXPECT to BE 2")
            await cyan.expect(promiseTwo).not.toBe(1) //.then(done) //() => done())
            await cyan.expect(promiseTwo).toBe(2) //.then(done) //() => done())

            console.log("EXPECT to BE 3")
            await cyan.expect(promiseThree).toBe(3) //.then(done) //.then(done) //() => done())
            done()
        })
    })
})