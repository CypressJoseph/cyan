import deepEquals from 'deep-equal';

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

    // type NullSubject = '__.cyan.no-subject.__'

    /**
     *  _Box_ implements an abstract monad-ish container pattern.
     *  (Similar to `cy`, `$`, `_` to some degree etc)
     */
    export class Box<Subject> implements Container<Subject> {
        klass = Box;
        static with<U>(entity: U) { return new Box<U>(entity); }
        static empty() { return new Box<{}>(new NullSubject()); }
        /**
         * Assemble a new Container around the entity.
         */
        constructor(protected entity: any) { }

        /**
         * Resolve yielded subject.
         */
        unwrap(): Subject { return this.entity; }

        /**
         * Yield an arbitrary subject.
         */
        wrap<T>(it: T): Box<T> { return Box.with(it); }
        /**
         * Pass subject to function, yielding result.
         * @param {Function} fn Function to invoke
         */
        apply<U>(fn: (t: Subject) => U): Box<U> {
            return Box.with(fn(this.unwrap()));
        }
        /**
         * Yield a named property on the subject.
         * @param {string} key Method name
         */
        // public its<K extends Property<Subject>, T extends Container>(
        //     key: K,
        //     maker?: ContainerMaker<T>
        // ): Box<Subject[K]>
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
         * @example
         *  // Yield obj.my.value
         *  cy.wrap(obj).glom(['my', 'value'])
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
            let res: R = fn(...args) as unknown as R;
            return Box.with<R>(res);
        }
        public expect<K extends Property<Subject>, P = Subject[K]>(key: K): Expectation<P>;
        public expect(): Expectation<Subject>;
        public expect<T, Subject extends NullSubject>(key?: T): Expectation<T>;
        public expect(key?: keyof Subject) {
            if (key && this.unwrap() instanceof NullSubject) {
                return new Expectation(key)
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
        klass = Expectation;
        static with<U>(entity: U): Expectation<U> {
            return new Expectation<U>(entity);
        }
        /**
         * Assemble a new Box around the entity.
         */
        constructor(entity: any, private negate?: boolean) {
            super(entity);
            // console.log("Expectation constructor: " + JSON.stringify(entity));
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
            let left = this.unwrap();
            let right = expected;
            if (expected instanceof Box) {
                right = expected.unwrap();
            }
            this.test(
                deepEquals(left, right),
                left + " to be deep-equal to " + right
            );
        }

        /**
         *
         * @param expr the expression to verify
         * @param message description of the expectation
         */
        private test(expr: boolean, message?: string) {
            let result = this.applyNegation(expr);
            if (!result) {
                throw new Error("Verification failed." + message);
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
            let prop = super.its(key) as Expectation<Subject[K]>;
            return prop;
        }
    }
}