import deepEquals from 'deep-equal';
import chalk from 'chalk';
import Timeout from 'await-timeout';

/**
 * Cyan is a helper library/framework for 'monadic-link'-style APIs.
 */
export namespace Cyan {
    export function sleep(milliseconds: number) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    type Property<Subject> = keyof Subject;
    type Method<Subject, K extends Property<Subject>> = ((...args: any[]) => any) & Subject[K];
    type A<T> = NonNullable<T>;

    type TestResult = {
        passed: boolean,
        actual: any,
    }

    interface Container<Subject> {
        its<K extends Property<Subject>>(key: K): Container<Subject[K]>;
        glom<T extends Subject, P1 extends keyof A<T>>(prop1: P1): Container<A<T>[P1]>;
        glom<T extends Subject, P1 extends keyof A<T>, P2 extends keyof A<A<T>[P1]>>(prop1: P1, prop2: P2): Container<A<A<T>[P1]>[P2]>;
        glom<T extends Subject, P1 extends keyof A<T>, P2 extends keyof A<A<T>[P1]>, P3 extends keyof A<A<A<T>[P1]>[P2]>>(prop1: P1, prop2: P2, prop3: P3): Container<A<A<A<T>[P1]>[P2]>[P3]>;
        glom(...path: string[]): Container<any>;
    }

    // interface FutureContainer<Subject> { }

    class NullSubject {}

    class Engine {
        public async testSoftly<U, V>(
            actual: () => U,
            expected: () => V,
            test: (u: U, v: V) => boolean,
            delay: number = 100
        ): Promise<TestResult> {
            let result: TestResult = {
                passed: false,
                actual: undefined
            }
            let startedAt = new Date().getTime()
            let elapsed = 0;
            while (!result.passed) {
                let now = new Date().getTime();
                elapsed = now - startedAt;
                let act = actual();
                let exp = expected();
                if (act instanceof Promise) {
                    act = await act;
                }
                result.passed = test(act, exp);
                result.actual = act;
                // console.log("TEST SOFTLY -- act=" + act + ", exp=" + exp + "--- PASSED? " + result.passed);
                if (!result.passed) { await sleep(delay); }
            }
            return result;
        }
    }

    /**
     *  _Box_ implements an abstract monad-ish container pattern.
     *  (Similar to `cy`, `$`, `_` to some degree etc)
     */
    export class Box<Subject> implements Container<Subject> {
        /**
         * Assemble a new box, yielding the provided entity.
         *
         * @param entity the value to yield to the link
         */
        static with<U>(entity: U): Box<U>;
        static with<U>(entity: Promise<U>): GiftBox<U>;
        static with(entity: any) {
            if (entity instanceof Promise) {
                return new GiftBox(entity);
            } else {
                return new Box(entity);
            }
        }

        /**
         * Build an empty box.
         * Throw an error on yield if opened without wrapping anything else.
         *
         * @param entity the value to yield to the link
         */
        static empty() { return new Box<{}>(new NullSubject()); }

        /**
         * Assemble a new Container around the entity.
         */
        constructor(protected entity: any) { }

        private get isEmpty() { return this.entity instanceof NullSubject }

        /**
         * Resolve yielded subject.
         * @example ```
         *   // Open and shut
         *   cyan.wrap(2+2).unwrap() // => 4
         * ```
         */
        public unwrap(): Subject;
        public unwrap<Subject extends NullSubject>(): never;
        public unwrap(): Subject {
            if (this.isEmpty) {
                throw new Error("An empty container cannot be unwrapped.");
            }
            return this.entity;
        }

        /**
         * Yield an arbitrary subject.
         * @example ```
         *   // Open and shut
         *   cyan.wrap(2+2).unwrap() // => 4
         * ```
         */
        public wrap<T>(it: T): Box<T> { return Box.with(it); }

        /**
         * Pass subject to function, yielding result.
         * @param {Function} fn Function to invoke
         * @example ```
         *   // apply square
         *   cyan.wrap(2+2).apply((x) => x*x).unwrap() // 16
         * ```
         */
        apply<U>(fn: (t: Subject) => U): Box<U> {
            let value = this.unwrap();
            return Box.with(fn(value));
        }

        /**
         * Pass elements of (array-like) subject to function, yielding result.
         * @param {Function} fn Function to invoke
         * @example ```
         *   // apply square
         *   cyan.wrap([1,2,3]).each((x) => x*x).unwrap() // [2,4,6]
         * ```
         */
        public each<T, U>(fn: (t: T) => U): Box<U[]> {
            let mapped = (this.unwrap() as unknown as Array<T>).map(it => fn(it))
            return Box.with(mapped);
        }

        /**
         * Pass elements of (array-like) subject to function, yielding result.
         * @param {Function} fn Function to invoke
         * @example ```
         *   // apply square
         *   cyan.wrap([1,2,3]).map((x) => x*x).unwrap() // [2,4,6]
         * ```
         */
        public map<T, U>(fn: (t: T) => U): Box<U[]> {
            let mapped = (this.unwrap() as unknown as Array<T>).map(fn)
            return Box.with(mapped);
        }

        /**
         * Filter elements of (array-like) subject by predicate, yielding result.
         * @param {Function} fn Function to invoke
         * @example ```
         *   // apply square
         *   cyan.wrap([1,2,3]).map((x) => x>2).unwrap() // [3]
         * ```
         */
        public filter<T>(fn: (t: T) => boolean): Box<T[]> {
            let picked = (this.unwrap() as unknown as Array<T>).filter(fn)
            return Box.with(picked);
        }

        /**
         * Yield a named property on the subject.
         * @param {string} key Method name
         * @example ```
         *   // Pluck `my.value` from the wrapped subject
         *   cyan.wrap({ my: { value: 'here' }}).its('my').its('value').unwrap() // => 'here'
         * ```
         */
        public its<K extends Property<Subject>>(key: K): Box<Subject[K]>;
        public its(key: string | number) {
            let theProperty = this.entity[key];
            return Box.with(theProperty);
        }

        /**
         *
         * Yield a nested property on the subject.
         *
         * @param {string} path Property path
         * @example ```
         *  // Yield my.value
         *  cyan.wrap({ my: { value: 'here' }})
         *      .glom('my', 'value')
         *      .unwrap() // => 'here'
         * 
         *  // Yield by path
         *  cyan.wrap({ my: { value: 'here' }})
         *      .glom('my.value')
         *      .unwrap() // => 'here'
         * ```
         */
        public glom<
            T extends Subject,
            P1 extends keyof A<T>
        >(prop1: P1): Box<A<T>[P1]>;
        public glom<
            T extends Subject,
            P1 extends keyof A<T>,
            P2 extends keyof A<A<T>[P1]>
        >(prop1: P1, prop2: P2): Box<A<A<T>[P1]>[P2]>;
        public glom<
            T extends Subject,
            P1 extends keyof A<T>,
            P2 extends keyof A<A<T>[P1]>,
            P3 extends keyof A<A<A<T>[P1]>[P2]>
        >(prop1: P1, prop2: P2, prop3: P3): Box<A<A<A<T>[P1]>[P2]>[P3]>;
        public glom(...path: string[]): Box<any>;
        public glom(...path: string[]) {
            let traverse = (result: any, prop: string) => result == null
                ? undefined
                : result[prop];
            let destination = path.reduce(traverse, this.unwrap());
            return Box.with(destination);
        }

        /**
         * Yield the result of calling a named method on the subject.
         * @arg key {string} the method name
         */
        invokes<K extends keyof Subject, F extends Method<Subject, K>, R = ReturnType<F>>(key: K, ...args: any[]): Box<R> {
            let fn: F = this.entity[key];
            let res: R = fn.call(this.entity, ...args) as unknown as R;
            return Box.with<R>(res);
        }

        /**
         * Declare an expectation on the yielded value.
         * @param key? {string} The property name to yield from subject (optional)
         */
        public expect(): Expectation<Subject>;
        public expect<T, Subject extends Promise<T>>(key?: T): DelayedExpectation<T>;
        public expect<K extends Property<Subject>, P = Subject[K]>(key: K): Expectation<P>;
        public expect<T, Subject extends NullSubject>(key?: T): Expectation<T>;
        public expect(key?: keyof Subject) {
            if (this.isEmpty) { // empty box
                if (key) {
                    return Expectation.with(key)
                } else {
                    throw new Error(
                        "Error: expect() called without arguments on empty box. Please provide an argument as the subject to verify against."
                    )
                }
            }
            if (key !== undefined) {
                return Expectation.with(this.its(key).unwrap());
            } else {
                return Expectation.with(this.unwrap());
            }
        }
    }
    
    export class GiftBox<U> extends Box<U> {
        // todo async versions of things?
    }

    /**
     * _Expectation_ extends Box and adds support for verification (test cases).
     */
    export class Expectation<Subject> extends Box<Subject> {
        /**
         * Assemble a new expectation, yielding the provided entity.
         * 
         * @param entity the value to yield to the link
         */
        static with<U>(entity: U, negate?: boolean): Expectation<U>;
        static with<U>(entity: Promise<U>, negate?: boolean): Expectation<U>;
        static with(entity: any, negate?: boolean) {
            if (entity instanceof Promise) {
                return new DelayedExpectation(entity, negate);
            } else {
                return new Expectation(entity, negate);
            }
        }
        /**
         * Assemble a new Box around the entity.
         */
        constructor(entity: any, protected negate?: boolean) {
            super(entity);
        }

        /**
         * Boolean invert
         * Expect the opposite of the expectation
         * @example
         *   // 2 + 2 !== 5
         *   cyan.expect(2+2).not.toBe(5)
         */
        public get not(): Expectation<Subject> {
            return Expectation.with(this.unwrap(), !this.negate);
        }

        /**
         * Expect subject to deep-equal value.
         * @arg expected {Subject} the expected value
         * @example
         *   // 2 + 2 == 4
         *   cyan.expect(2+2).toBe(4)
         */
        public toBe(expected: Subject): void;
        public toBe(expected: any): void {
            let passed = false;
            let actual = this.unwrap();
            passed = this.isTruthy(deepEquals(actual, expected))
            if (passed === false) {
                this.fail(expected, actual, "be deep equal")
            }
        }

        protected errorDescription(expected: string, actual: string, claim: string) {
            return chalk.gray([
                "Expected yielded value to ",
                chalk.green(claim),
                " to ",
                chalk.blue(expected),
                " but got ",
                chalk.magenta(actual),
                " instead."
            ].join(''))
        }

        protected fail(expected: any, actual: any, message: string) {
            let err = this.errorDescription(
                JSON.stringify(expected),
                JSON.stringify(actual),
                message
            )
            throw new Error(err);
        }

        /**
         *
         * @param value the expression to verify
         * @param message description of the expectation
         */
        protected isTruthy(value: boolean): boolean {
            return this.applyNegation(value);
        }

        private applyNegation(value: boolean) {
            if (this.negate) {
                return !value;
            }
            else {
                return !!value;
            }
        }

        public glom<T extends Subject, P1 extends keyof A<T>>(prop1: P1): Expectation<A<T>[P1]>;
        public glom<T extends Subject, P1 extends keyof A<T>, P2 extends keyof A<A<T>[P1]>>(prop1: P1, prop2: P2): Expectation<A<A<T>[P1]>[P2]>;
        public glom<T extends Subject,
            P1 extends keyof A<T>,
            P2 extends keyof A<A<T>[P1]>,
            P3 extends keyof A<A<A<T>[P1]>[P2]>
        >(prop1: P1, prop2: P2, prop3: P3): Expectation<A<A<A<T>[P1]>[P2]>[P3]>;
        public glom(...path: string[]): Expectation<any>;
        public glom(...path: string[]) {
            let traverse = (result: any, prop: string) => result == null
                ? undefined
                : result[prop];
            let destination = path.reduce(traverse, this.unwrap());
            return Expectation.with(destination);
        }

        public its<K extends Property<Subject>>(key: K): Expectation<Subject[K]> {
            let theProperty = this.entity[key];
            return Expectation.with(theProperty);
        }

        /**
         * Pass subject to function, yielding result.
         * @param {Function} fn Function to invoke
         * @example ```
         *   // apply square
         *   cyan.wrap(2+2).apply((x) => x*x).unwrap() // 16
         * ```
         */
        apply<U>(fn: (t: Subject) => U): Expectation<U> {
            return Expectation.with(fn(this.unwrap()));
        }
    }

    export class DelayedExpectation<Subject> extends Expectation<Subject> {
        public async toBe<T>(expected: T): Promise<void> {
            let engine: Engine = new Engine();
            let passed = false;
            let actual = this.unwrap();
            if (this.unwrap() instanceof Promise) {
                let result: TestResult = await Timeout.wrap(engine.testSoftly(
                    () => this.unwrap(),
                    () => expected,
                    (act: any, exp: any) => this.isTruthy(deepEquals(act, exp)),
                ), 4000, "toBe timed out waiting for promise to resolve")
                actual = result.actual;
                passed = result.passed;
            }
            if (passed === false) {
                this.fail(expected, actual, 'be deep equal')
            }
        }

        public get not(): DelayedExpectation<Subject> {
            return new DelayedExpectation(this.unwrap(), !this.negate);
        }
    }
}