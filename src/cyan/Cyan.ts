import deepEquals from 'deep-equal';
import chalk from 'chalk';

/**
 * Cyan is a helper library/framework for 'monadic-link'-style APIs.
 */
export namespace Cyan {
    type Property<Subject> = keyof Subject;
    type Method<Subject, K extends Property<Subject>> = ((...args: any[]) => any) & Subject[K];
    type A<T> = NonNullable<T>;
    interface Container<Subject> {
        its<K extends Property<Subject>>(key: K): Container<Subject[K]>;
        glom<T extends Subject, P1 extends keyof A<T>>(prop1: P1): Container<A<T>[P1]>;
        glom<T extends Subject, P1 extends keyof A<T>, P2 extends keyof A<A<T>[P1]>>(prop1: P1, prop2: P2): Container<A<A<T>[P1]>[P2]>;
        glom<T extends Subject, P1 extends keyof A<T>, P2 extends keyof A<A<T>[P1]>, P3 extends keyof A<A<A<T>[P1]>[P2]>>(prop1: P1, prop2: P2, prop3: P3): Container<A<A<A<T>[P1]>[P2]>[P3]>;
        glom(...path: string[]): Container<any>;
    }

    class NullSubject {}

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
        static with<U>(entity: U) { return new Box<U>(entity); }

        /**
         * Get an empty box.
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
            return Box.with(fn(this.unwrap()));
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
        public its(key: string) {
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
         * Claim an expectation on the yielded value.
         * An empty box 
         * @param key? {string} The property name to yield from subject (optional)
         */
        public expect<K extends Property<Subject>, P = Subject[K]>(key: K): Expectation<P>;
        public expect(): Expectation<Subject>;
        public expect<T, Subject extends NullSubject>(key?: T): Expectation<T>;
        public expect(key?: keyof Subject) {
            if (this.isEmpty) { // empty box
                if (key) {
                    return new Expectation(key)
                } else {
                    throw new Error(
                        "Error: expect() called without arguments on empty box. Please provide an argument as the subject to verify against."
                    )
                }
            }
            if (key && key !== undefined) {
                return new Expectation(this.its(key).unwrap());
            } else {
                return new Expectation(this.unwrap());
            }
        }
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
        static with<U>(entity: U): Expectation<U> {
            return new Expectation<U>(entity);
        }
        /**
         * Assemble a new Box around the entity.
         */
        constructor(entity: any, private negate?: boolean) {
            super(entity);
        }

        /**
         * Boolean invert
         * Expect the opposite of the expectation
         */
        public get not(): Expectation<Subject> {
            return new Expectation<Subject>(this.unwrap(), !this.negate);
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
            let actual = this.unwrap();
            // let right = expected;
            this.test(
                deepEquals(actual, expected),
                this.errorDescription(
                    JSON.stringify(expected),
                    JSON.stringify(actual),
                    "be deep equal"
                )
            );
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

        /**
         *
         * @param expr the expression to verify
         * @param message description of the expectation
         */
        private test(expr: boolean, message?: string) {
            let passed = this.applyNegation(expr);
            if (passed === false) {
                throw new Error(
                    chalk.red("Expectation failed!") +
                    "\n\n" +
                    message
                );
            }
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
}