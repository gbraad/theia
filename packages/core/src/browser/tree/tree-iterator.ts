/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { TreeNode, CompositeTreeNode } from "./tree";
import { ExpandableTreeNode } from "./tree-expansion";

export interface TreeIterator extends Iterator<TreeNode> {
}

export namespace TreeIterator {

    export interface Options {
        readonly pruneCollapsed: boolean
    }

    export const DEFAULT_OPTIONS: Options = {
        pruneCollapsed: false
    };

}

export abstract class AbstractTreeIterator implements TreeIterator, Iterable<TreeNode> {

    protected readonly delegate: IterableIterator<TreeNode>;

    constructor(protected readonly root: TreeNode, protected readonly options: TreeIterator.Options = TreeIterator.DEFAULT_OPTIONS) {
        this.delegate = this.iterator(this.root);
    }

    [Symbol.iterator]() {
        return this.delegate;
    }

    next(): IteratorResult<TreeNode> {
        return this.delegate.next();
    }

    protected abstract iterator(node: TreeNode): IterableIterator<TreeNode>;

    protected children(node: TreeNode): TreeNode[] | undefined {
        if (!CompositeTreeNode.is(node)) {
            return undefined;
        }
        if (this.options.pruneCollapsed && this.isCollapsed(node)) {
            return undefined;
        }
        return node.children.slice();
    }

    protected isCollapsed(node: TreeNode): boolean {
        return ExpandableTreeNode.isCollapsed(node);
    }

    protected isEmpty(nodes: TreeNode[] | undefined): boolean {
        return nodes === undefined || nodes.length === 0;
    }

}

export class DepthFirstTreeIterator extends AbstractTreeIterator {

    constructor(protected readonly root: TreeNode, protected readonly options: TreeIterator.Options = TreeIterator.DEFAULT_OPTIONS) {
        super(root, options);
    }

    protected iterator(root: TreeNode): IterableIterator<TreeNode> {
        return Iterators.depthFirst(root, this.children.bind(this));
    }

}

export class BreadthFirstTreeIterator extends AbstractTreeIterator {

    constructor(protected readonly root: TreeNode, protected readonly options: TreeIterator.Options = TreeIterator.DEFAULT_OPTIONS) {
        super(root, options);
    }

    protected iterator(root: TreeNode): IterableIterator<TreeNode> {
        return Iterators.breadthFirst(root, this.children.bind(this));
    }

}

/**
 * This tree iterator visits all nodes from top to bottom considering the following rules.
 *
 * Let assume the following tree:
 * ```
 *   R
 *   |
 *   +---1
 *   |   |
 *   |   +---1.1
 *   |   |
 *   |   +---1.2
 *   |   |
 *   |   +---1.3
 *   |   |    |
 *   |   |    +---1.3.1
 *   |   |    |
 *   |   |    +---1.3.2
 *   |   |
 *   |   +---1.4
 *   |
 *   +---2
 *       |
 *       +---2.1
 * ```
 * When selecting `1.2` as the root, the normal `DepthFirstTreeIterator` would stop on `1.2` as it does not have children,
 * but this iterator will visit the next sibling (`1.3` and `1.4` but **not** `1.1`) nodes. So the expected traversal order will be
 * `1.2`, `1.3`, `1.3.1`, `1.3.2`,  and `1.4` then jumps to `2` and continues with `2.1`.
 */
export class TopDownTreeIterator extends DepthFirstTreeIterator {

    constructor(protected readonly root: TreeNode, protected readonly options: TreeIterator.Options = TreeIterator.DEFAULT_OPTIONS) {
        super(root, options);
    }

    protected iterator(root: TreeNode): IterableIterator<TreeNode> {
        const doNext = this.doNext.bind(this);
        return (function* (): IterableIterator<TreeNode> {
            let next = root;
            while (next) {
                yield next;
                next = doNext(next);
            }
        }).bind(this)();
    }

    protected doNext(node: TreeNode): TreeNode | undefined {
        return this.findFirstChild(node) || this.findNextSibling(node);
    }

    protected findFirstChild(node: TreeNode): TreeNode | undefined {
        return (this.children(node) || [])[0];
    }

    protected findNextSibling(node: TreeNode | undefined): TreeNode | undefined {
        if (!node) {
            return undefined;
        }
        const nextSibling = TreeNode.getNextSibling(node);
        if (nextSibling) {
            return nextSibling;
        }
        return this.findNextSibling(node.parent);
    }

}

/**
 * Unlike other tree iterators, this does not visit all the nodes, it stops once it reaches the root node
 * while traversing up the tree hierarchy in an inverse pre-order fashion. This is the counterpart of the `TopDownTreeIterator`.
 */
export class BottomUpTreeIterator extends AbstractTreeIterator {

    constructor(protected readonly root: TreeNode, protected readonly options: TreeIterator.Options = TreeIterator.DEFAULT_OPTIONS) {
        super(root, options);
    }

    protected iterator(root: TreeNode): IterableIterator<TreeNode> {
        const doNext = this.doNext.bind(this);
        return (function* (): IterableIterator<TreeNode> {
            let next = root;
            while (next) {
                yield next;
                next = doNext(next);
            }
        }).bind(this)();
    }

    protected doNext(node: TreeNode): TreeNode | undefined {
        const previousSibling = TreeNode.getPrevSibling(node);
        const lastChild = this.lastChild(previousSibling);
        return lastChild || node.parent;
    }

    protected lastChild(node: TreeNode | undefined): TreeNode | undefined {
        const children = node ? this.children(node) : [];
        if (this.isEmpty(children)) {
            return node;
        }
        if (CompositeTreeNode.is(node)) {
            const lastChild = CompositeTreeNode.getLastChild(node);
            return this.lastChild(lastChild);
        }
        return undefined;
    }

}

export namespace Iterators {

    /**
     * Generator for depth first, pre-order tree traversal iteration.
     */
    export function* depthFirst<T>(root: T, children: (node: T) => T[] | undefined, include: (node: T) => boolean = () => true): IterableIterator<T> {
        const stack: T[] = [];
        stack.push(root);
        while (stack.length > 0) {
            const top = stack.pop()!;
            yield top;
            stack.push(...(children(top) || []).filter(include).reverse());
        }
    }

    /**
     * Generator for breadth first tree traversal iteration.
     */
    export function* breadthFirst<T>(root: T, children: (node: T) => T[] | undefined, include: (node: T) => boolean = () => true): IterableIterator<T> {
        const queue: T[] = [];
        queue.push(root);
        while (queue.length > 0) {
            const head = queue.shift()!;
            yield head;
            queue.push(...(children(head) || []).filter(include));
        }
    }

}
