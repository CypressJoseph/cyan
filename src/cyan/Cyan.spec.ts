import cyan from ".";
import { Cyan } from "./Cyan";

describe("Cyan", () => {
    describe("Box", () => {
        it('wrap/unwrap', () => {
            expect(
                cyan.wrap("hello").unwrap()
            ).toBe("hello")

            expect(
                cyan.wrap(123).unwrap()
            ).toBe(123)
        })
    });
})

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
            cyan.expect(2+2).toBe(4)
            cyan.wrap({ my: { value: 'here' } })
                .glom('my', 'value')
                .expect().toBe('here')
            })

            it('readme', () => {
                cyan.expect({ a: { b: 3 } }).glom('a', 'b').apply(x => x * x).toBe(9)
            })

            // cyan.wrap({ my: { value: 'here' } })
            //     .glom('my.value')
            //     .expect().toBe('here')
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

        it('throws', () => {
            expect(
                ()=>model.expect('a').toBe('not-value')
            ).toThrow() //ExpectationFailedError)

            expect(
                () => cyan.expect()
            ).toThrow() // EmptyExpect
        })

    })

    describe("Box", () => {
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

        it('invokes a method', () => {
            model.invokes('fn').expect().toBe(true)
            cyan.wrap(2+2).invokes('valueOf').expect().toBe(4)
            cyan.wrap(2+2).invokes('toString').expect().toBe('4')
        })

        it('applies a function', () => {
            cyan.wrap(2+2).apply(x => x*x).expect().toBe(16)
            model.its('a').apply((str) => str.length).expect().toBe(5)
        })

        test.todo('seals')
    })

})