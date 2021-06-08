
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var global$1 = (typeof global$1 !== "undefined" ? global$1 :
  typeof self !== "undefined" ? self :
  typeof window !== "undefined" ? window : {});

function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function validate_store(store, name) {
    if (store != null && typeof store.subscribe !== 'function') {
        throw new Error(`'${name}' is not a store with a 'subscribe' method`);
    }
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
    const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function exclude_internal_props(props) {
    const result = {};
    for (const k in props)
        if (k[0] !== '$')
            result[k] = props[k];
    return result;
}
function null_to_empty(value) {
    return value == null ? '' : value;
}
function set_store_value(store, ret, value = ret) {
    store.set(value);
    return ret;
}
function action_destroyer(action_result) {
    return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
}
function hasContext(key) {
    return get_current_component().$$.context.has(key);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function tick() {
    schedule_update();
    return resolved_promise;
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

const globals = (typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
        ? globalThis
        : global$1);

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function get_spread_object(spread_props) {
    return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
}

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : options.context || []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
}
function append_dev(target, node) {
    dispatch_dev('SvelteDOMInsert', { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev('SvelteDOMInsert', { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev('SvelteDOMRemove', { node });
    detach(node);
}
function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
    const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
    if (has_prevent_default)
        modifiers.push('preventDefault');
    if (has_stop_propagation)
        modifiers.push('stopPropagation');
    dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
    const dispose = listen(node, event, handler, options);
    return () => {
        dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
        dispose();
    };
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
    else
        dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
}
function prop_dev(node, property, value) {
    node[property] = value;
    dispatch_dev('SvelteDOMSetProperty', { node, property, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.wholeText === data)
        return;
    dispatch_dev('SvelteDOMSetData', { node: text, data });
    text.data = data;
}
function validate_each_argument(arg) {
    if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
        let msg = '{#each} only iterates over array-like objects.';
        if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
            msg += ' You can use a spread to convert this iterable into an array.';
        }
        throw new Error(msg);
    }
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
/**
 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
 */
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error("'target' is a required option");
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn('Component was already destroyed'); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}

/* src/components/Nav.svelte generated by Svelte v3.38.2 */

const file$3 = "src/components/Nav.svelte";

function create_fragment$5(ctx) {
	let div2;
	let button;
	let img0;
	let img0_src_value;
	let t0;
	let div0;
	let img1;
	let img1_src_value;
	let t1;
	let h1;
	let t3;
	let div1;
	let t4;
	let nav;
	let a;
	let img2;
	let img2_src_value;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			div2 = element("div");
			button = element("button");
			img0 = element("img");
			t0 = space();
			div0 = element("div");
			img1 = element("img");
			t1 = space();
			h1 = element("h1");
			h1.textContent = "Clio";
			t3 = space();
			div1 = element("div");
			t4 = space();
			nav = element("nav");
			a = element("a");
			img2 = element("img");
			if (img0.src !== (img0_src_value = "/bars-light.svg")) attr_dev(img0, "src", img0_src_value);
			attr_dev(img0, "alt", "hamburger");
			attr_dev(img0, "class", "svelte-7zkt4l");
			add_location(img0, file$3, 9, 4, 170);
			attr_dev(button, "class", "hamburger svelte-7zkt4l");
			add_location(button, file$3, 8, 2, 117);
			if (img1.src !== (img1_src_value = "/logo-512x512.png")) attr_dev(img1, "src", img1_src_value);
			attr_dev(img1, "alt", "Clio");
			attr_dev(img1, "class", "logo svelte-7zkt4l");
			add_location(img1, file$3, 12, 4, 263);
			attr_dev(h1, "class", "svelte-7zkt4l");
			add_location(h1, file$3, 13, 4, 323);
			attr_dev(div0, "class", "logo-container svelte-7zkt4l");
			add_location(div0, file$3, 11, 2, 230);
			attr_dev(div1, "class", "spacer svelte-7zkt4l");
			add_location(div1, file$3, 15, 2, 348);
			if (img2.src !== (img2_src_value = "/github.png")) attr_dev(img2, "src", img2_src_value);
			attr_dev(img2, "alt", "Github");
			attr_dev(img2, "class", "svelte-7zkt4l");
			add_location(img2, file$3, 18, 6, 446);
			attr_dev(a, "href", "https://github.com/clio-lang/clio");
			attr_dev(a, "class", "svelte-7zkt4l");
			add_location(a, file$3, 17, 4, 395);
			attr_dev(nav, "class", "nav svelte-7zkt4l");
			add_location(nav, file$3, 16, 2, 373);
			attr_dev(div2, "class", "head svelte-7zkt4l");
			add_location(div2, file$3, 7, 0, 96);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div2, anchor);
			append_dev(div2, button);
			append_dev(button, img0);
			append_dev(div2, t0);
			append_dev(div2, div0);
			append_dev(div0, img1);
			append_dev(div0, t1);
			append_dev(div0, h1);
			append_dev(div2, t3);
			append_dev(div2, div1);
			append_dev(div2, t4);
			append_dev(div2, nav);
			append_dev(nav, a);
			append_dev(a, img2);

			if (!mounted) {
				dispose = listen_dev(button, "click", /*toggleMenu*/ ctx[0], false, false, false);
				mounted = true;
			}
		},
		p: noop,
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div2);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$5.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$5($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Nav", slots, []);
	let { menuOpen } = $$props;
	const toggleMenu = () => $$invalidate(1, menuOpen = !menuOpen);
	const writable_props = ["menuOpen"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Nav> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("menuOpen" in $$props) $$invalidate(1, menuOpen = $$props.menuOpen);
	};

	$$self.$capture_state = () => ({ menuOpen, toggleMenu });

	$$self.$inject_state = $$props => {
		if ("menuOpen" in $$props) $$invalidate(1, menuOpen = $$props.menuOpen);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [toggleMenu, menuOpen];
}

class Nav extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$5, create_fragment$5, safe_not_equal, { menuOpen: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Nav",
			options,
			id: create_fragment$5.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*menuOpen*/ ctx[1] === undefined && !("menuOpen" in props)) {
			console.warn("<Nav> was created without expected prop 'menuOpen'");
		}
	}

	get menuOpen() {
		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set menuOpen(value) {
		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/SideNavItem.svelte generated by Svelte v3.38.2 */

const { Object: Object_1 } = globals;
const file$2 = "src/components/SideNavItem.svelte";

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[2] = list[i];
	return child_ctx;
}

// (30:0) {:else}
function create_else_block$1(ctx) {
	let a;
	let span;
	let t0_value = /*tree*/ ctx[0].__subtree.index.__meta.title + "";
	let t0;
	let t1;
	let t2;
	let if_block1_anchor;
	let current;
	let mounted;
	let dispose;

	function select_block_type_1(ctx, dirty) {
		if (/*expanded*/ ctx[3]) return create_if_block_2$1;
		return create_else_block_1;
	}

	let current_block_type = select_block_type_1(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*expanded*/ ctx[3] && create_if_block_1$1(ctx);

	const block = {
		c: function create() {
			a = element("a");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			if_block0.c();
			t2 = space();
			if (if_block1) if_block1.c();
			if_block1_anchor = empty();
			add_location(span, file$2, 37, 4, 774);
			attr_dev(a, "class", "expandable svelte-1u2kyle");
			attr_dev(a, "href", /*href*/ ctx[4]);
			toggle_class(a, "active", /*active*/ ctx[6]);
			toggle_class(a, "inner", /*level*/ ctx[1]);
			add_location(a, file$2, 30, 2, 660);
		},
		m: function mount(target, anchor) {
			insert_dev(target, a, anchor);
			append_dev(a, span);
			append_dev(span, t0);
			append_dev(a, t1);
			if_block0.m(a, null);
			insert_dev(target, t2, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert_dev(target, if_block1_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = listen_dev(a, "click", /*toggleExpand*/ ctx[7], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if ((!current || dirty & /*tree*/ 1) && t0_value !== (t0_value = /*tree*/ ctx[0].__subtree.index.__meta.title + "")) set_data_dev(t0, t0_value);

			if (current_block_type !== (current_block_type = select_block_type_1(ctx))) {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(a, null);
				}
			}

			if (dirty & /*level*/ 2) {
				toggle_class(a, "inner", /*level*/ ctx[1]);
			}

			if (/*expanded*/ ctx[3]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*expanded*/ 8) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block_1$1(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block1);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block1);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(a);
			if_block0.d();
			if (detaching) detach_dev(t2);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach_dev(if_block1_anchor);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block$1.name,
		type: "else",
		source: "(30:0) {:else}",
		ctx
	});

	return block;
}

// (28:0) {#if !tree.__subtree}
function create_if_block$2(ctx) {
	let a;
	let t_value = /*tree*/ ctx[0].__meta.title + "";
	let t;

	const block = {
		c: function create() {
			a = element("a");
			t = text(t_value);
			attr_dev(a, "href", /*href*/ ctx[4]);
			attr_dev(a, "class", "svelte-1u2kyle");
			toggle_class(a, "active", /*active*/ ctx[6]);
			toggle_class(a, "inner", /*level*/ ctx[1]);
			add_location(a, file$2, 28, 2, 583);
		},
		m: function mount(target, anchor) {
			insert_dev(target, a, anchor);
			append_dev(a, t);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*tree*/ 1 && t_value !== (t_value = /*tree*/ ctx[0].__meta.title + "")) set_data_dev(t, t_value);

			if (dirty & /*level*/ 2) {
				toggle_class(a, "inner", /*level*/ ctx[1]);
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(a);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$2.name,
		type: "if",
		source: "(28:0) {#if !tree.__subtree}",
		ctx
	});

	return block;
}

// (41:4) {:else}
function create_else_block_1(ctx) {
	let img;
	let img_src_value;

	const block = {
		c: function create() {
			img = element("img");
			if (img.src !== (img_src_value = "/chevron-right-light.svg")) attr_dev(img, "src", img_src_value);
			attr_dev(img, "alt", "Expand");
			attr_dev(img, "class", "svelte-1u2kyle");
			add_location(img, file$2, 41, 6, 919);
		},
		m: function mount(target, anchor) {
			insert_dev(target, img, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(img);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block_1.name,
		type: "else",
		source: "(41:4) {:else}",
		ctx
	});

	return block;
}

// (39:4) {#if expanded}
function create_if_block_2$1(ctx) {
	let img;
	let img_src_value;

	const block = {
		c: function create() {
			img = element("img");
			if (img.src !== (img_src_value = "/chevron-down-light.svg")) attr_dev(img, "src", img_src_value);
			attr_dev(img, "alt", "Expanded");
			attr_dev(img, "class", "svelte-1u2kyle");
			add_location(img, file$2, 39, 6, 848);
		},
		m: function mount(target, anchor) {
			insert_dev(target, img, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(img);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_2$1.name,
		type: "if",
		source: "(39:4) {#if expanded}",
		ctx
	});

	return block;
}

// (45:2) {#if expanded}
function create_if_block_1$1(ctx) {
	let each_1_anchor;
	let current;
	let each_value = /*keysOf*/ ctx[5](/*tree*/ ctx[0]);
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	const block = {
		c: function create() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m: function mount(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insert_dev(target, each_1_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			if (dirty & /*keysOf, tree, level*/ 35) {
				each_value = /*keysOf*/ ctx[5](/*tree*/ ctx[0]);
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o: function outro(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d: function destroy(detaching) {
			destroy_each(each_blocks, detaching);
			if (detaching) detach_dev(each_1_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1$1.name,
		type: "if",
		source: "(45:2) {#if expanded}",
		ctx
	});

	return block;
}

// (46:4) {#each keysOf(tree) as key}
function create_each_block$2(ctx) {
	let sidenavitem;
	let current;

	sidenavitem = new SideNavItem({
			props: {
				key: /*key*/ ctx[2],
				tree: /*tree*/ ctx[0].__subtree[/*key*/ ctx[2]],
				level: /*level*/ ctx[1] + 1
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(sidenavitem.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(sidenavitem, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const sidenavitem_changes = {};
			if (dirty & /*tree*/ 1) sidenavitem_changes.key = /*key*/ ctx[2];
			if (dirty & /*tree*/ 1) sidenavitem_changes.tree = /*tree*/ ctx[0].__subtree[/*key*/ ctx[2]];
			if (dirty & /*level*/ 2) sidenavitem_changes.level = /*level*/ ctx[1] + 1;
			sidenavitem.$set(sidenavitem_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(sidenavitem.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(sidenavitem.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(sidenavitem, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block$2.name,
		type: "each",
		source: "(46:4) {#each keysOf(tree) as key}",
		ctx
	});

	return block;
}

function create_fragment$4(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$2, create_else_block$1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (!/*tree*/ ctx[0].__subtree) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$4.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$4($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("SideNavItem", slots, []);
	let { tree } = $$props;
	let { key } = $$props;
	let { level = 0 } = $$props;
	const href = "/" + (key === "." ? "" : key);

	const keysOf = tree => {
		const { index, ...rest } = tree.__subtree;

		return Object.keys(rest).sort((lhs, rhs) => {
			return tree.__subtree[lhs].__meta.order - tree.__subtree[rhs].__meta.order;
		});
	};

	let active = false;
	let expanded = false;

	/* $: active = $page.path === href;
$: expanded = $page.path.startsWith(href); */
	const toggleExpand = () => $$invalidate(3, expanded = !expanded);

	const writable_props = ["tree", "key", "level"];

	Object_1.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SideNavItem> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("tree" in $$props) $$invalidate(0, tree = $$props.tree);
		if ("key" in $$props) $$invalidate(2, key = $$props.key);
		if ("level" in $$props) $$invalidate(1, level = $$props.level);
	};

	$$self.$capture_state = () => ({
		tree,
		key,
		level,
		href,
		keysOf,
		active,
		expanded,
		toggleExpand
	});

	$$self.$inject_state = $$props => {
		if ("tree" in $$props) $$invalidate(0, tree = $$props.tree);
		if ("key" in $$props) $$invalidate(2, key = $$props.key);
		if ("level" in $$props) $$invalidate(1, level = $$props.level);
		if ("active" in $$props) $$invalidate(6, active = $$props.active);
		if ("expanded" in $$props) $$invalidate(3, expanded = $$props.expanded);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [tree, level, key, expanded, href, keysOf, active, toggleExpand];
}

class SideNavItem extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$4, create_fragment$4, safe_not_equal, { tree: 0, key: 2, level: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "SideNavItem",
			options,
			id: create_fragment$4.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*tree*/ ctx[0] === undefined && !("tree" in props)) {
			console.warn("<SideNavItem> was created without expected prop 'tree'");
		}

		if (/*key*/ ctx[2] === undefined && !("key" in props)) {
			console.warn("<SideNavItem> was created without expected prop 'key'");
		}
	}

	get tree() {
		throw new Error("<SideNavItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set tree(value) {
		throw new Error("<SideNavItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get key() {
		throw new Error("<SideNavItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set key(value) {
		throw new Error("<SideNavItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get level() {
		throw new Error("<SideNavItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set level(value) {
		throw new Error("<SideNavItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

var routes = {
	".": {
	__subtree: {
		index: {
			__meta: {
				title: "Getting started",
				order: 0
			}
		},
		install: {
			__meta: {
				title: "Install",
				order: 0
			}
		}
	}
}
};

var variants = [
	"v0.9.0"
];

/* src/components/SideNav.svelte generated by Svelte v3.38.2 */
const file$1 = "src/components/SideNav.svelte";

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[3] = list[i];
	return child_ctx;
}

// (26:6) {#each variants as variant}
function create_each_block$1(ctx) {
	let option;
	let t0_value = /*variant*/ ctx[3] + "";
	let t0;
	let t1;
	let option_selected_value;

	const block = {
		c: function create() {
			option = element("option");
			t0 = text(t0_value);
			t1 = space();
			option.__value = /*variant*/ ctx[3];
			option.value = option.__value;
			option.selected = option_selected_value = /*variant*/ ctx[3] == /*currentVariant*/ ctx[0];
			add_location(option, file$1, 26, 8, 590);
		},
		m: function mount(target, anchor) {
			insert_dev(target, option, anchor);
			append_dev(option, t0);
			append_dev(option, t1);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*currentVariant*/ 1 && option_selected_value !== (option_selected_value = /*variant*/ ctx[3] == /*currentVariant*/ ctx[0])) {
				prop_dev(option, "selected", option_selected_value);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(option);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block$1.name,
		type: "each",
		source: "(26:6) {#each variants as variant}",
		ctx
	});

	return block;
}

function create_fragment$3(ctx) {
	let div1;
	let div0;
	let select;
	let t;
	let sidenavitem;
	let current;
	let each_value = variants;
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	sidenavitem = new SideNavItem({
			props: { key: ".", tree: routes["."] },
			$$inline: true
		});

	const block = {
		c: function create() {
			div1 = element("div");
			div0 = element("div");
			select = element("select");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
			create_component(sidenavitem.$$.fragment);
			attr_dev(select, "class", "svelte-1ya97bc");
			add_location(select, file$1, 24, 4, 539);
			attr_dev(div0, "class", "variants svelte-1ya97bc");
			add_location(div0, file$1, 23, 2, 512);
			attr_dev(div1, "class", "sidenav svelte-1ya97bc");
			toggle_class(div1, "open", /*menuOpen*/ ctx[1]);
			add_location(div1, file$1, 22, 0, 466);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div1, anchor);
			append_dev(div1, div0);
			append_dev(div0, select);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select, null);
			}

			append_dev(div1, t);
			mount_component(sidenavitem, div1, null);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*variants, currentVariant*/ 1) {
				each_value = variants;
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (dirty & /*menuOpen*/ 2) {
				toggle_class(div1, "open", /*menuOpen*/ ctx[1]);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(sidenavitem.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(sidenavitem.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div1);
			destroy_each(each_blocks, detaching);
			destroy_component(sidenavitem);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$3.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$3($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("SideNav", slots, []);
	let { menuOpen } = $$props;
	let { currentVariant } = $$props;
	const latestVariant = variants.slice().sort((lhs, rhs) => rhs.localeCompare(lhs)).shift();

	onMount(() => {
		$$invalidate(0, currentVariant = window.location.pathname.split("/").shift() || latestVariant);
	});

	const writable_props = ["menuOpen", "currentVariant"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SideNav> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("menuOpen" in $$props) $$invalidate(1, menuOpen = $$props.menuOpen);
		if ("currentVariant" in $$props) $$invalidate(0, currentVariant = $$props.currentVariant);
	};

	$$self.$capture_state = () => ({
		onMount,
		SideNavItem,
		routes,
		variants,
		menuOpen,
		currentVariant,
		latestVariant
	});

	$$self.$inject_state = $$props => {
		if ("menuOpen" in $$props) $$invalidate(1, menuOpen = $$props.menuOpen);
		if ("currentVariant" in $$props) $$invalidate(0, currentVariant = $$props.currentVariant);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [currentVariant, menuOpen];
}

class SideNav extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { menuOpen: 1, currentVariant: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "SideNav",
			options,
			id: create_fragment$3.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*menuOpen*/ ctx[1] === undefined && !("menuOpen" in props)) {
			console.warn("<SideNav> was created without expected prop 'menuOpen'");
		}

		if (/*currentVariant*/ ctx[0] === undefined && !("currentVariant" in props)) {
			console.warn("<SideNav> was created without expected prop 'currentVariant'");
		}
	}

	get menuOpen() {
		throw new Error("<SideNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set menuOpen(value) {
		throw new Error("<SideNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get currentVariant() {
		throw new Error("<SideNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set currentVariant(value) {
		throw new Error("<SideNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

function p(e,a=!1){return e=e.slice(e.startsWith("/#")?2:0,e.endsWith("/*")?-2:void 0),e.startsWith("/")||(e="/"+e),e==="/"&&(e=""),a&&!e.endsWith("/")&&(e+="/"),e}function d(e,a){e=p(e,!0),a=p(a,!0);let r=[],n={},t=!0,s=e.split("/").map(c=>c.startsWith(":")?(r.push(c.slice(1)),"([^\\/]+)"):c).join("\\/"),o=a.match(new RegExp(`^${s}$`));return o||(t=!1,o=a.match(new RegExp(`^${s}`))),o?(r.forEach((c,m)=>n[c]=o[m+1]),{exact:t,params:n,part:o[0].slice(0,-1)}):null}function x(e,a,r){if(r==="")return e;if(r[0]==="/")return r;let n=o=>o.split("/").filter(c=>c!==""),t=n(e),s=a?n(a):[];return "/"+s.map((o,c)=>t[c]).join("/")+"/"+r}function f(e,a,r,n){let t=[a,"data-"+a].reduce((s,o)=>{let c=e.getAttribute(o);return r&&e.removeAttribute(o),c===null?s:c},!1);return !n&&t===""?!0:t||n||!1}function O(e){let a=e.split("&").map(r=>r.split("=")).reduce((r,n)=>{let t=n[0];if(!t)return r;let s=n.length>1?n[n.length-1]:!0;return typeof s=="string"&&s.includes(",")&&(s=s.split(",")),r[t]===void 0?r[t]=[s]:r[t].push(s),r},{});return Object.entries(a).reduce((r,n)=>(r[n[0]]=n[1].length>1?n[1]:n[1][0],r),{})}function S(e){return Object.entries(e).map(([a,r])=>r?r===!0?a:`${a}=${Array.isArray(r)?r.join(","):r}`:null).filter(a=>a).join("&")}function w(e,a){return e?a+e:""}function k(e){throw new Error("[Tinro] "+e)}var i={HISTORY:1,HASH:2,MEMORY:3,OFF:4,run(e,a,r,n){return e===this.HISTORY?a&&a():e===this.HASH?r&&r():n&&n()},getDefault(){return !window||window.location.pathname==="srcdoc"?this.MEMORY:this.HISTORY}};var R,v,M,l=_();function _(){let e=i.getDefault(),a,r=o=>window.onhashchange=window.onpopstate=R=null,n=o=>a&&a(y(e)),t=o=>{o&&(e=o),r(),e!==i.OFF&&i.run(e,c=>window.onpopstate=n,c=>window.onhashchange=n)&&n();},s=o=>{let c=Object.assign(y(e),o);return c.path+w(S(c.query),"?")+w(c.hash,"#")};return {mode:t,get:o=>y(e),go(o,c){A(e,o,c),n();},start(o){a=o,t();},stop(){a=null,t(i.OFF);},set(o){this.go(s(o),!o.path);},methods(){return C(this)}}}function A(e,a,r){!r&&(v=M);let n=t=>history[`${r?"replace":"push"}State`]({},"",t);i.run(e,t=>n(a),t=>n(`#${a}`),t=>R=a);}function y(e){let a=window.location,r=i.run(e,t=>a.pathname+a.search+a.hash,t=>String(a.hash.slice(1)||"/"),t=>R||"/"),n=r.match(/^([^?#]+)(?:\?([^#]+))?(?:\#(.+))?$/);return M=r,{url:r,from:v,path:n[1]||"",query:O(n[2]||""),hash:n[3]||""}}function C(e){let a=()=>e.get().query,r=o=>e.set({query:o}),n=o=>r(o(a())),t=()=>e.get().hash,s=o=>e.set({hash:o});return {hash:{get:t,set:s,clear:()=>s("")},query:{replace:r,clear:()=>r(""),get(o){return o?a()[o]:a()},set(o,c){n(m=>(m[o]=c,m));},delete(o){n(c=>(c[o]&&delete c[o],c));}}}}var h=Y();function Y(){let{subscribe:e}=writable(l.get(),a=>{l.start(a);let r=P(l.go);return ()=>{l.stop(),r();}});return {subscribe:e,goto:l.go,params:Q,meta:b,useHashNavigation:a=>l.mode(a?i.HASH:i.HISTORY),mode:{hash:()=>l.mode(i.HASH),history:()=>l.mode(i.HISTORY),memory:()=>l.mode(i.MEMORY)},location:l.methods()}}function P(e){let a=r=>{let n=r.target.closest("a[href]"),t=n&&f(n,"target",!1,"_self"),s=n&&f(n,"tinro-ignore"),o=r.ctrlKey||r.metaKey||r.altKey||r.shiftKey;if(t=="_self"&&!s&&!o&&n){let c=n.getAttribute("href").replace(/^\/#/,"");/^\/\/|^[a-zA-Z]+:/.test(c)||(r.preventDefault(),e(c.startsWith("/")?c:n.href.replace(window.location.origin,"")));}};return addEventListener("click",a),()=>removeEventListener("click",a)}function Q(){return getContext("tinro").meta.params}var g="tinro",K=$({pattern:"",matched:!0});function E(e){let a=getContext(g)||K;(a.exact||a.fallback)&&k(`${e.fallback?"<Route fallback>":`<Route path="${e.path}">`}  can't be inside ${a.fallback?"<Route fallback>":`<Route path="${a.path||"/"}"> with exact path`}`);let r=e.fallback?"fallbacks":"childs",n=writable({}),t=$({fallback:e.fallback,parent:a,update(s){t.exact=!s.path.endsWith("/*"),t.pattern=p(`${t.parent.pattern||""}${s.path}`),t.redirect=s.redirect,t.firstmatch=s.firstmatch,t.breadcrumb=s.breadcrumb,t.match();},register:()=>(t.parent[r].add(t),()=>{t.parent[r].delete(t),t.router.un&&t.router.un();}),show:()=>{e.onShow(),!t.fallback&&t.parent.activeChilds.add(t);},hide:()=>{e.onHide(),!t.fallback&&t.parent.activeChilds.delete(t);},match:async()=>{t.matched=!1;let{path:s,url:o,from:c,query:m}=t.router.location,u=d(t.pattern,s);if(!t.fallback&&u&&t.redirect&&(!t.exact||t.exact&&u.exact)){let L=x(s,t.parent.pattern,t.redirect);return h.goto(L,!0)}t.meta=u&&{from:c,url:o,query:m,match:u.part,pattern:t.pattern,breadcrumbs:t.parent.meta&&t.parent.meta.breadcrumbs.slice()||[],params:u.params,subscribe:n.subscribe},t.breadcrumb&&t.meta&&t.meta.breadcrumbs.push({name:t.breadcrumb,path:u.part}),n.set(t.meta),u&&!t.fallback&&(!t.exact||t.exact&&u.exact)&&(!t.parent.firstmatch||!t.parent.matched)?(e.onMeta(t.meta),t.parent.matched=!0,t.show()):t.hide(),u&&t.showFallbacks();}});return setContext(g,t),onMount(()=>t.register()),t}function b(){return hasContext(g)?getContext(g).meta:k("meta() function must be run inside any `<Route>` child component only")}function $(e){let a={router:{},exact:!1,pattern:null,meta:null,parent:null,fallback:!1,redirect:!1,firstmatch:!1,breadcrumb:null,matched:!1,childs:new Set,activeChilds:new Set,fallbacks:new Set,async showFallbacks(){if(!this.fallback&&(await tick(),this.childs.size>0&&this.activeChilds.size==0||this.childs.size==0&&this.fallbacks.size>0)){let r=this;for(;r.fallbacks.size==0;)if(r=r.parent,!r)return;r&&r.fallbacks.forEach(n=>{if(n.redirect){let t=x("/",n.parent.pattern,n.redirect);h.goto(t,!0);}else n.show();});}},start(){this.router.un||(this.router.un=h.subscribe(r=>{this.router.location=r,this.pattern!==null&&this.match();}));},match(){this.showFallbacks();}};return Object.assign(a,e),a.start(),a}

/* node_modules/tinro/cmp/Route.svelte generated by Svelte v3.38.2 */

const get_default_slot_changes$1 = dirty => ({
	params: dirty & /*params*/ 2,
	meta: dirty & /*meta*/ 4
});

const get_default_slot_context$1 = ctx => ({
	params: /*params*/ ctx[1],
	meta: /*meta*/ ctx[2]
});

// (33:0) {#if showContent}
function create_if_block$1(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[9].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], get_default_slot_context$1);

	const block = {
		c: function create() {
			if (default_slot) default_slot.c();
		},
		m: function mount(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope, params, meta*/ 262)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, get_default_slot_changes$1, get_default_slot_context$1);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(33:0) {#if showContent}",
		ctx
	});

	return block;
}

function create_fragment$2(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*showContent*/ ctx[0] && create_if_block$1(ctx);

	const block = {
		c: function create() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (/*showContent*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*showContent*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block$1(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$2.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$2($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Route", slots, ['default']);
	let { path = "/*" } = $$props;
	let { fallback = false } = $$props;
	let { redirect = false } = $$props;
	let { firstmatch = false } = $$props;
	let { breadcrumb = null } = $$props;
	let showContent = false;
	let params = {}; /* DEPRECATED */
	let meta = {};

	const route = E({
		fallback,
		onShow() {
			$$invalidate(0, showContent = true);
		},
		onHide() {
			$$invalidate(0, showContent = false);
		},
		onMeta(newmeta) {
			$$invalidate(2, meta = newmeta);
			$$invalidate(1, params = meta.params); /* DEPRECATED */
		}
	});

	const writable_props = ["path", "fallback", "redirect", "firstmatch", "breadcrumb"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Route> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("path" in $$props) $$invalidate(3, path = $$props.path);
		if ("fallback" in $$props) $$invalidate(4, fallback = $$props.fallback);
		if ("redirect" in $$props) $$invalidate(5, redirect = $$props.redirect);
		if ("firstmatch" in $$props) $$invalidate(6, firstmatch = $$props.firstmatch);
		if ("breadcrumb" in $$props) $$invalidate(7, breadcrumb = $$props.breadcrumb);
		if ("$$scope" in $$props) $$invalidate(8, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		createRouteObject: E,
		path,
		fallback,
		redirect,
		firstmatch,
		breadcrumb,
		showContent,
		params,
		meta,
		route
	});

	$$self.$inject_state = $$props => {
		if ("path" in $$props) $$invalidate(3, path = $$props.path);
		if ("fallback" in $$props) $$invalidate(4, fallback = $$props.fallback);
		if ("redirect" in $$props) $$invalidate(5, redirect = $$props.redirect);
		if ("firstmatch" in $$props) $$invalidate(6, firstmatch = $$props.firstmatch);
		if ("breadcrumb" in $$props) $$invalidate(7, breadcrumb = $$props.breadcrumb);
		if ("showContent" in $$props) $$invalidate(0, showContent = $$props.showContent);
		if ("params" in $$props) $$invalidate(1, params = $$props.params);
		if ("meta" in $$props) $$invalidate(2, meta = $$props.meta);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*path, redirect, firstmatch, breadcrumb*/ 232) {
			route.update({ path, redirect, firstmatch, breadcrumb });
		}
	};

	return [
		showContent,
		params,
		meta,
		path,
		fallback,
		redirect,
		firstmatch,
		breadcrumb,
		$$scope,
		slots
	];
}

class Route extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
			path: 3,
			fallback: 4,
			redirect: 5,
			firstmatch: 6,
			breadcrumb: 7
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Route",
			options,
			id: create_fragment$2.name
		});
	}

	get path() {
		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set path(value) {
		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get fallback() {
		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set fallback(value) {
		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get redirect() {
		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set redirect(value) {
		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get firstmatch() {
		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set firstmatch(value) {
		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get breadcrumb() {
		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set breadcrumb(value) {
		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/svelte-loadable/Loadable.svelte generated by Svelte v3.38.2 */
const get_default_slot_changes = dirty => ({ component: dirty & /*component*/ 1 });
const get_default_slot_context = ctx => ({ component: /*component*/ ctx[0] });
const get_success_slot_changes = dirty => ({ component: dirty & /*component*/ 1 });
const get_success_slot_context = ctx => ({ component: /*component*/ ctx[0] });
const get_loading_slot_changes = dirty => ({ component: dirty & /*component*/ 1 });
const get_loading_slot_context = ctx => ({ component: /*component*/ ctx[0] });
const get_timeout_slot_changes = dirty => ({ component: dirty & /*component*/ 1 });
const get_timeout_slot_context = ctx => ({ component: /*component*/ ctx[0] });

const get_error_slot_changes = dirty => ({
	error: dirty & /*error*/ 2,
	component: dirty & /*component*/ 1
});

const get_error_slot_context = ctx => ({
	error: /*error*/ ctx[1],
	component: /*component*/ ctx[0]
});

// (157:35) 
function create_if_block_3(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_4, create_if_block_5, create_else_block];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*slots*/ ctx[4] && /*slots*/ ctx[4].success) return 0;
		if (/*slots*/ ctx[4] && /*slots*/ ctx[4].default) return 1;
		return 2;
	}

	current_block_type_index = select_block_type_1(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			if_block.p(ctx, dirty);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_3.name,
		type: "if",
		source: "(157:35) ",
		ctx
	});

	return block;
}

// (155:35) 
function create_if_block_2(ctx) {
	let current;
	const loading_slot_template = /*#slots*/ ctx[11].loading;
	const loading_slot = create_slot(loading_slot_template, ctx, /*$$scope*/ ctx[10], get_loading_slot_context);

	const block = {
		c: function create() {
			if (loading_slot) loading_slot.c();
		},
		m: function mount(target, anchor) {
			if (loading_slot) {
				loading_slot.m(target, anchor);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (loading_slot) {
				if (loading_slot.p && (!current || dirty & /*$$scope, component*/ 1025)) {
					update_slot(loading_slot, loading_slot_template, ctx, /*$$scope*/ ctx[10], dirty, get_loading_slot_changes, get_loading_slot_context);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(loading_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(loading_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (loading_slot) loading_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_2.name,
		type: "if",
		source: "(155:35) ",
		ctx
	});

	return block;
}

// (153:35) 
function create_if_block_1(ctx) {
	let current;
	const timeout_slot_template = /*#slots*/ ctx[11].timeout;
	const timeout_slot = create_slot(timeout_slot_template, ctx, /*$$scope*/ ctx[10], get_timeout_slot_context);

	const block = {
		c: function create() {
			if (timeout_slot) timeout_slot.c();
		},
		m: function mount(target, anchor) {
			if (timeout_slot) {
				timeout_slot.m(target, anchor);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (timeout_slot) {
				if (timeout_slot.p && (!current || dirty & /*$$scope, component*/ 1025)) {
					update_slot(timeout_slot, timeout_slot_template, ctx, /*$$scope*/ ctx[10], dirty, get_timeout_slot_changes, get_timeout_slot_context);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(timeout_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(timeout_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (timeout_slot) timeout_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1.name,
		type: "if",
		source: "(153:35) ",
		ctx
	});

	return block;
}

// (151:0) {#if state === STATES.ERROR}
function create_if_block(ctx) {
	let current;
	const error_slot_template = /*#slots*/ ctx[11].error;
	const error_slot = create_slot(error_slot_template, ctx, /*$$scope*/ ctx[10], get_error_slot_context);

	const block = {
		c: function create() {
			if (error_slot) error_slot.c();
		},
		m: function mount(target, anchor) {
			if (error_slot) {
				error_slot.m(target, anchor);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (error_slot) {
				if (error_slot.p && (!current || dirty & /*$$scope, error, component*/ 1027)) {
					update_slot(error_slot, error_slot_template, ctx, /*$$scope*/ ctx[10], dirty, get_error_slot_changes, get_error_slot_context);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(error_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(error_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (error_slot) error_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(151:0) {#if state === STATES.ERROR}",
		ctx
	});

	return block;
}

// (162:2) {:else}
function create_else_block(ctx) {
	let switch_instance;
	let switch_instance_anchor;
	let current;
	const switch_instance_spread_levels = [/*componentProps*/ ctx[3]];
	var switch_value = /*component*/ ctx[0];

	function switch_props(ctx) {
		let switch_instance_props = {};

		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
		}

		return {
			props: switch_instance_props,
			$$inline: true
		};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props());
	}

	const block = {
		c: function create() {
			if (switch_instance) create_component(switch_instance.$$.fragment);
			switch_instance_anchor = empty();
		},
		m: function mount(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert_dev(target, switch_instance_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const switch_instance_changes = (dirty & /*componentProps*/ 8)
			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*componentProps*/ ctx[3])])
			: {};

			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props());
					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			} else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},
		i: function intro(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(switch_instance_anchor);
			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block.name,
		type: "else",
		source: "(162:2) {:else}",
		ctx
	});

	return block;
}

// (160:35) 
function create_if_block_5(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[11].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], get_default_slot_context);

	const block = {
		c: function create() {
			if (default_slot) default_slot.c();
		},
		m: function mount(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope, component*/ 1025)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[10], dirty, get_default_slot_changes, get_default_slot_context);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_5.name,
		type: "if",
		source: "(160:35) ",
		ctx
	});

	return block;
}

// (158:2) {#if slots && slots.success}
function create_if_block_4(ctx) {
	let current;
	const success_slot_template = /*#slots*/ ctx[11].success;
	const success_slot = create_slot(success_slot_template, ctx, /*$$scope*/ ctx[10], get_success_slot_context);

	const block = {
		c: function create() {
			if (success_slot) success_slot.c();
		},
		m: function mount(target, anchor) {
			if (success_slot) {
				success_slot.m(target, anchor);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (success_slot) {
				if (success_slot.p && (!current || dirty & /*$$scope, component*/ 1025)) {
					update_slot(success_slot, success_slot_template, ctx, /*$$scope*/ ctx[10], dirty, get_success_slot_changes, get_success_slot_context);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(success_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(success_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (success_slot) success_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_4.name,
		type: "if",
		source: "(158:2) {#if slots && slots.success}",
		ctx
	});

	return block;
}

function create_fragment$1(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2, create_if_block_3];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*state*/ ctx[2] === STATES.ERROR) return 0;
		if (/*state*/ ctx[2] === STATES.TIMEOUT) return 1;
		if (/*state*/ ctx[2] === STATES.LOADING) return 2;
		if (/*state*/ ctx[2] === STATES.SUCCESS) return 3;
		return -1;
	}

	if (~(current_block_type_index = select_block_type(ctx))) {
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	}

	const block = {
		c: function create() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(target, anchor);
			}

			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				}
			} else {
				if (if_block) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				} else {
					if_block = null;
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d(detaching);
			}

			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

const ALL_LOADERS = new Map();
const LOADED = new Map();

const STATES = Object.freeze({
	INITIALIZED: 0,
	LOADING: 1,
	SUCCESS: 2,
	ERROR: 3,
	TIMEOUT: 4
});

function findByResolved(resolved) {
	for (let [loader, r] of ALL_LOADERS) {
		if (r === resolved) return loader;
	}

	return null;
}

function register(loadable) {
	const resolved = loadable.resolve();
	const loader = findByResolved(resolved);
	if (loader) return loader;
	ALL_LOADERS.set(loadable.loader, resolved);
	return loadable.loader;
}

function preloadAll() {
	return Promise.all(Array.from(ALL_LOADERS.keys()).filter(loader => !LOADED.has(loader)).map(async loader => load(loader))).then(() => {
		/** If new loaders have been registered by loaded components, load them next. */
		if (ALL_LOADERS.size > LOADED.size) {
			return preloadAll();
		}
	});
}

async function load(loader, unloader) {
	const componentModule = await loader();
	const component = componentModule.default || componentModule;

	if (!unloader) {
		LOADED.set(loader, component);
	}

	return component;
}

let loadComponent = load;

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots$1 = {}, $$scope } = $$props;
	validate_slots("Loadable", slots$1, ['error','timeout','loading','success','default']);
	let { delay = 200 } = $$props;
	let { timeout = null } = $$props;
	let { loader = null } = $$props;
	let { unloader = false } = $$props;
	let { component = null } = $$props;
	let { error = null } = $$props;
	let load_timer = null;
	let timeout_timer = null;
	let state = STATES.INITIALIZED;
	let componentProps;
	let slots = $$props.$$slots;
	let mounted = false;
	const dispatch = createEventDispatcher();
	const capture = getContext("svelte-loadable-capture");

	if (typeof capture === "function" && ALL_LOADERS.has(loader)) {
		capture(loader);
	}

	function clearTimers() {
		clearTimeout(load_timer);
		clearTimeout(timeout_timer);
	}

	async function load() {
		clearTimers();

		if (typeof loader !== "function") {
			return;
		}

		$$invalidate(1, error = null);
		$$invalidate(0, component = null);

		if (delay > 0) {
			$$invalidate(2, state = STATES.INITIALIZED);

			load_timer = setTimeout(
				() => {
					$$invalidate(2, state = STATES.LOADING);
				},
				parseFloat(delay)
			);
		} else {
			$$invalidate(2, state = STATES.LOADING);
		}

		if (timeout) {
			timeout_timer = setTimeout(
				() => {
					$$invalidate(2, state = STATES.TIMEOUT);
				},
				parseFloat(timeout)
			);
		}

		try {
			$$invalidate(0, component = await loadComponent(loader, unloader));
			$$invalidate(2, state = STATES.SUCCESS);
		} catch(e) {
			$$invalidate(2, state = STATES.ERROR);
			$$invalidate(1, error = e);

			if (slots == null || slots.error == null) {
				throw e;
			}
		}

		clearTimers();
	}

	if (LOADED.has(loader)) {
		state = STATES.SUCCESS;
		component = LOADED.get(loader);
	} else {
		onMount(() => {
			mounted = true;

			load().then(() => {
				if (mounted) {
					dispatch("load");
				}
			});

			return () => {
				mounted = false;

				if (typeof unloader === "function") {
					unloader();
				}
			};
		});
	}

	$$self.$$set = $$new_props => {
		$$invalidate(18, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		if ("delay" in $$new_props) $$invalidate(5, delay = $$new_props.delay);
		if ("timeout" in $$new_props) $$invalidate(6, timeout = $$new_props.timeout);
		if ("loader" in $$new_props) $$invalidate(7, loader = $$new_props.loader);
		if ("unloader" in $$new_props) $$invalidate(8, unloader = $$new_props.unloader);
		if ("component" in $$new_props) $$invalidate(0, component = $$new_props.component);
		if ("error" in $$new_props) $$invalidate(1, error = $$new_props.error);
		if ("$$scope" in $$new_props) $$invalidate(10, $$scope = $$new_props.$$scope);
	};

	$$self.$capture_state = () => ({
		ALL_LOADERS,
		LOADED,
		STATES,
		findByResolved,
		register,
		preloadAll,
		load,
		loadComponent,
		onMount,
		getContext,
		createEventDispatcher,
		delay,
		timeout,
		loader,
		unloader,
		component,
		error,
		load_timer,
		timeout_timer,
		state,
		componentProps,
		slots,
		mounted,
		dispatch,
		capture,
		clearTimers,
		load
	});

	$$self.$inject_state = $$new_props => {
		$$invalidate(18, $$props = assign(assign({}, $$props), $$new_props));
		if ("delay" in $$props) $$invalidate(5, delay = $$new_props.delay);
		if ("timeout" in $$props) $$invalidate(6, timeout = $$new_props.timeout);
		if ("loader" in $$props) $$invalidate(7, loader = $$new_props.loader);
		if ("unloader" in $$props) $$invalidate(8, unloader = $$new_props.unloader);
		if ("component" in $$props) $$invalidate(0, component = $$new_props.component);
		if ("error" in $$props) $$invalidate(1, error = $$new_props.error);
		if ("load_timer" in $$props) load_timer = $$new_props.load_timer;
		if ("timeout_timer" in $$props) timeout_timer = $$new_props.timeout_timer;
		if ("state" in $$props) $$invalidate(2, state = $$new_props.state);
		if ("componentProps" in $$props) $$invalidate(3, componentProps = $$new_props.componentProps);
		if ("slots" in $$props) $$invalidate(4, slots = $$new_props.slots);
		if ("mounted" in $$props) mounted = $$new_props.mounted;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		{
			let { delay, timeout, loader, component, error, ...rest } = $$props;
			$$invalidate(3, componentProps = rest);
		}
	};

	$$props = exclude_internal_props($$props);

	return [
		component,
		error,
		state,
		componentProps,
		slots,
		delay,
		timeout,
		loader,
		unloader,
		load,
		$$scope,
		slots$1
	];
}

class Loadable extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			delay: 5,
			timeout: 6,
			loader: 7,
			unloader: 8,
			component: 0,
			error: 1,
			load: 9
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Loadable",
			options,
			id: create_fragment$1.name
		});
	}

	get delay() {
		throw new Error("<Loadable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set delay(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get timeout() {
		throw new Error("<Loadable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set timeout(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get loader() {
		throw new Error("<Loadable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set loader(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get unloader() {
		throw new Error("<Loadable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set unloader(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get component() {
		throw new Error("<Loadable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set component(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get error() {
		throw new Error("<Loadable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set error(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get load() {
		return this.$$.ctx[9];
	}

	set load(value) {
		throw new Error("<Loadable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

function dynamicImport(path) {
  switch (path) {
    case "./meta/v0.9.0.json":
      return import('./v0.9.0-5200d30c.js');
    case "./routes/v0.9.0/index.svelte":
      return import('./index-a1d7daa8.js');
  }
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getAugmentedNamespace(n) {
	if (n.__esModule) return n;
	var a = Object.defineProperty({}, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var slugify$1 = {exports: {}};

(function (module, exports) {
(function (name, root, factory) {
  {
    module.exports = factory();
    module.exports['default'] = factory();
  }
}('slugify', commonjsGlobal, function () {
  var charMap = JSON.parse('{"$":"dollar","%":"percent","&":"and","<":"less",">":"greater","|":"or","¢":"cent","£":"pound","¤":"currency","¥":"yen","©":"(c)","ª":"a","®":"(r)","º":"o","À":"A","Á":"A","Â":"A","Ã":"A","Ä":"A","Å":"A","Æ":"AE","Ç":"C","È":"E","É":"E","Ê":"E","Ë":"E","Ì":"I","Í":"I","Î":"I","Ï":"I","Ð":"D","Ñ":"N","Ò":"O","Ó":"O","Ô":"O","Õ":"O","Ö":"O","Ø":"O","Ù":"U","Ú":"U","Û":"U","Ü":"U","Ý":"Y","Þ":"TH","ß":"ss","à":"a","á":"a","â":"a","ã":"a","ä":"a","å":"a","æ":"ae","ç":"c","è":"e","é":"e","ê":"e","ë":"e","ì":"i","í":"i","î":"i","ï":"i","ð":"d","ñ":"n","ò":"o","ó":"o","ô":"o","õ":"o","ö":"o","ø":"o","ù":"u","ú":"u","û":"u","ü":"u","ý":"y","þ":"th","ÿ":"y","Ā":"A","ā":"a","Ă":"A","ă":"a","Ą":"A","ą":"a","Ć":"C","ć":"c","Č":"C","č":"c","Ď":"D","ď":"d","Đ":"DJ","đ":"dj","Ē":"E","ē":"e","Ė":"E","ė":"e","Ę":"e","ę":"e","Ě":"E","ě":"e","Ğ":"G","ğ":"g","Ģ":"G","ģ":"g","Ĩ":"I","ĩ":"i","Ī":"i","ī":"i","Į":"I","į":"i","İ":"I","ı":"i","Ķ":"k","ķ":"k","Ļ":"L","ļ":"l","Ľ":"L","ľ":"l","Ł":"L","ł":"l","Ń":"N","ń":"n","Ņ":"N","ņ":"n","Ň":"N","ň":"n","Ō":"O","ō":"o","Ő":"O","ő":"o","Œ":"OE","œ":"oe","Ŕ":"R","ŕ":"r","Ř":"R","ř":"r","Ś":"S","ś":"s","Ş":"S","ş":"s","Š":"S","š":"s","Ţ":"T","ţ":"t","Ť":"T","ť":"t","Ũ":"U","ũ":"u","Ū":"u","ū":"u","Ů":"U","ů":"u","Ű":"U","ű":"u","Ų":"U","ų":"u","Ŵ":"W","ŵ":"w","Ŷ":"Y","ŷ":"y","Ÿ":"Y","Ź":"Z","ź":"z","Ż":"Z","ż":"z","Ž":"Z","ž":"z","Ə":"E","ƒ":"f","Ơ":"O","ơ":"o","Ư":"U","ư":"u","ǈ":"LJ","ǉ":"lj","ǋ":"NJ","ǌ":"nj","Ș":"S","ș":"s","Ț":"T","ț":"t","ə":"e","˚":"o","Ά":"A","Έ":"E","Ή":"H","Ί":"I","Ό":"O","Ύ":"Y","Ώ":"W","ΐ":"i","Α":"A","Β":"B","Γ":"G","Δ":"D","Ε":"E","Ζ":"Z","Η":"H","Θ":"8","Ι":"I","Κ":"K","Λ":"L","Μ":"M","Ν":"N","Ξ":"3","Ο":"O","Π":"P","Ρ":"R","Σ":"S","Τ":"T","Υ":"Y","Φ":"F","Χ":"X","Ψ":"PS","Ω":"W","Ϊ":"I","Ϋ":"Y","ά":"a","έ":"e","ή":"h","ί":"i","ΰ":"y","α":"a","β":"b","γ":"g","δ":"d","ε":"e","ζ":"z","η":"h","θ":"8","ι":"i","κ":"k","λ":"l","μ":"m","ν":"n","ξ":"3","ο":"o","π":"p","ρ":"r","ς":"s","σ":"s","τ":"t","υ":"y","φ":"f","χ":"x","ψ":"ps","ω":"w","ϊ":"i","ϋ":"y","ό":"o","ύ":"y","ώ":"w","Ё":"Yo","Ђ":"DJ","Є":"Ye","І":"I","Ї":"Yi","Ј":"J","Љ":"LJ","Њ":"NJ","Ћ":"C","Џ":"DZ","А":"A","Б":"B","В":"V","Г":"G","Д":"D","Е":"E","Ж":"Zh","З":"Z","И":"I","Й":"J","К":"K","Л":"L","М":"M","Н":"N","О":"O","П":"P","Р":"R","С":"S","Т":"T","У":"U","Ф":"F","Х":"H","Ц":"C","Ч":"Ch","Ш":"Sh","Щ":"Sh","Ъ":"U","Ы":"Y","Ь":"","Э":"E","Ю":"Yu","Я":"Ya","а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ж":"zh","з":"z","и":"i","й":"j","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sh","ъ":"u","ы":"y","ь":"","э":"e","ю":"yu","я":"ya","ё":"yo","ђ":"dj","є":"ye","і":"i","ї":"yi","ј":"j","љ":"lj","њ":"nj","ћ":"c","ѝ":"u","џ":"dz","Ґ":"G","ґ":"g","Ғ":"GH","ғ":"gh","Қ":"KH","қ":"kh","Ң":"NG","ң":"ng","Ү":"UE","ү":"ue","Ұ":"U","ұ":"u","Һ":"H","һ":"h","Ә":"AE","ә":"ae","Ө":"OE","ө":"oe","฿":"baht","ა":"a","ბ":"b","გ":"g","დ":"d","ე":"e","ვ":"v","ზ":"z","თ":"t","ი":"i","კ":"k","ლ":"l","მ":"m","ნ":"n","ო":"o","პ":"p","ჟ":"zh","რ":"r","ს":"s","ტ":"t","უ":"u","ფ":"f","ქ":"k","ღ":"gh","ყ":"q","შ":"sh","ჩ":"ch","ც":"ts","ძ":"dz","წ":"ts","ჭ":"ch","ხ":"kh","ჯ":"j","ჰ":"h","Ẁ":"W","ẁ":"w","Ẃ":"W","ẃ":"w","Ẅ":"W","ẅ":"w","ẞ":"SS","Ạ":"A","ạ":"a","Ả":"A","ả":"a","Ấ":"A","ấ":"a","Ầ":"A","ầ":"a","Ẩ":"A","ẩ":"a","Ẫ":"A","ẫ":"a","Ậ":"A","ậ":"a","Ắ":"A","ắ":"a","Ằ":"A","ằ":"a","Ẳ":"A","ẳ":"a","Ẵ":"A","ẵ":"a","Ặ":"A","ặ":"a","Ẹ":"E","ẹ":"e","Ẻ":"E","ẻ":"e","Ẽ":"E","ẽ":"e","Ế":"E","ế":"e","Ề":"E","ề":"e","Ể":"E","ể":"e","Ễ":"E","ễ":"e","Ệ":"E","ệ":"e","Ỉ":"I","ỉ":"i","Ị":"I","ị":"i","Ọ":"O","ọ":"o","Ỏ":"O","ỏ":"o","Ố":"O","ố":"o","Ồ":"O","ồ":"o","Ổ":"O","ổ":"o","Ỗ":"O","ỗ":"o","Ộ":"O","ộ":"o","Ớ":"O","ớ":"o","Ờ":"O","ờ":"o","Ở":"O","ở":"o","Ỡ":"O","ỡ":"o","Ợ":"O","ợ":"o","Ụ":"U","ụ":"u","Ủ":"U","ủ":"u","Ứ":"U","ứ":"u","Ừ":"U","ừ":"u","Ử":"U","ử":"u","Ữ":"U","ữ":"u","Ự":"U","ự":"u","Ỳ":"Y","ỳ":"y","Ỵ":"Y","ỵ":"y","Ỷ":"Y","ỷ":"y","Ỹ":"Y","ỹ":"y","–":"-","‘":"\'","’":"\'","“":"\\\"","”":"\\\"","„":"\\\"","†":"+","•":"*","…":"...","₠":"ecu","₢":"cruzeiro","₣":"french franc","₤":"lira","₥":"mill","₦":"naira","₧":"peseta","₨":"rupee","₩":"won","₪":"new shequel","₫":"dong","€":"euro","₭":"kip","₮":"tugrik","₯":"drachma","₰":"penny","₱":"peso","₲":"guarani","₳":"austral","₴":"hryvnia","₵":"cedi","₸":"kazakhstani tenge","₹":"indian rupee","₺":"turkish lira","₽":"russian ruble","₿":"bitcoin","℠":"sm","™":"tm","∂":"d","∆":"delta","∑":"sum","∞":"infinity","♥":"love","元":"yuan","円":"yen","﷼":"rial"}');
  var locales = JSON.parse('{"de":{"Ä":"AE","ä":"ae","Ö":"OE","ö":"oe","Ü":"UE","ü":"ue","%":"prozent","&":"und","|":"oder","∑":"summe","∞":"unendlich","♥":"liebe"},"es":{"%":"por ciento","&":"y","<":"menor que",">":"mayor que","|":"o","¢":"centavos","£":"libras","¤":"moneda","₣":"francos","∑":"suma","∞":"infinito","♥":"amor"},"fr":{"%":"pourcent","&":"et","<":"plus petit",">":"plus grand","|":"ou","¢":"centime","£":"livre","¤":"devise","₣":"franc","∑":"somme","∞":"infini","♥":"amour"},"pt":{"%":"porcento","&":"e","<":"menor",">":"maior","|":"ou","¢":"centavo","∑":"soma","£":"libra","∞":"infinito","♥":"amor"},"uk":{"И":"Y","и":"y","Й":"Y","й":"y","Ц":"Ts","ц":"ts","Х":"Kh","х":"kh","Щ":"Shch","щ":"shch","Г":"H","г":"h"},"vi":{"Đ":"D","đ":"d"}}');

  function replace (string, options) {
    if (typeof string !== 'string') {
      throw new Error('slugify: string argument expected')
    }

    options = (typeof options === 'string')
      ? {replacement: options}
      : options || {};

    var locale = locales[options.locale] || {};

    var replacement = options.replacement === undefined ? '-' : options.replacement;

    var slug = string.normalize().split('')
      // replace characters based on charMap
      .reduce(function (result, ch) {
        return result + (locale[ch] || charMap[ch] ||  (ch === replacement ? ' ' : ch))
          // remove not allowed characters
          .replace(options.remove || /[^\w\s$*_+~.()'"!\-:@]+/g, '')
      }, '');

    if (options.strict) {
      slug = slug.replace(/[^A-Za-z0-9\s]/g, '');
    }

    // Remove leading/trailing spaces, then replace all other spaces with
    // replacement character, treating multiple consecutive spaces as a single
    // space.
    slug = slug.trim()
      .replace(/\s+/g, replacement);

    if (options.lower) {
      slug = slug.toLowerCase();
    }

    return slug
  }

  replace.extend = function (customMap) {
    Object.assign(charMap, customMap);
  };

  return replace
}));
}(slugify$1));

var slugify = slugify$1.exports;

const tabsContext = Symbol("Tabs");
const currentSection = Symbol("currentSection");

var keys = { tabsContext, currentSection };

/* src/App.svelte generated by Svelte v3.38.2 */

const { console: console_1 } = globals;
const file = "src/App.svelte";

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[10] = list[i];
	return child_ctx;
}

// (51:6) <Loadable loader={getComponent(meta)} let:component>
function create_default_slot_1(ctx) {
	let switch_instance;
	let updating_sections;
	let switch_instance_anchor;
	let current;

	function switch_instance_sections_binding(value) {
		/*switch_instance_sections_binding*/ ctx[9](value);
	}

	var switch_value = /*component*/ ctx[14];

	function switch_props(ctx) {
		let switch_instance_props = {};

		if (/*sections*/ ctx[0] !== void 0) {
			switch_instance_props.sections = /*sections*/ ctx[0];
		}

		return {
			props: switch_instance_props,
			$$inline: true
		};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props(ctx));
		binding_callbacks.push(() => bind(switch_instance, "sections", switch_instance_sections_binding));
	}

	const block = {
		c: function create() {
			if (switch_instance) create_component(switch_instance.$$.fragment);
			switch_instance_anchor = empty();
		},
		m: function mount(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert_dev(target, switch_instance_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const switch_instance_changes = {};

			if (!updating_sections && dirty & /*sections*/ 1) {
				updating_sections = true;
				switch_instance_changes.sections = /*sections*/ ctx[0];
				add_flush_callback(() => updating_sections = false);
			}

			if (switch_value !== (switch_value = /*component*/ ctx[14])) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props(ctx));
					binding_callbacks.push(() => bind(switch_instance, "sections", switch_instance_sections_binding));
					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			} else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},
		i: function intro(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(switch_instance_anchor);
			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_1.name,
		type: "slot",
		source: "(51:6) <Loadable loader={getComponent(meta)} let:component>",
		ctx
	});

	return block;
}

// (50:4) <Route path="/*" let:meta>
function create_default_slot(ctx) {
	let loadable;
	let current;

	loadable = new Loadable({
			props: {
				loader: /*getComponent*/ ctx[6](/*meta*/ ctx[13]),
				$$slots: {
					default: [
						create_default_slot_1,
						({ component }) => ({ 14: component }),
						({ component }) => component ? 16384 : 0
					]
				},
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(loadable.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(loadable, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const loadable_changes = {};
			if (dirty & /*meta*/ 8192) loadable_changes.loader = /*getComponent*/ ctx[6](/*meta*/ ctx[13]);

			if (dirty & /*$$scope, component, sections*/ 49153) {
				loadable_changes.$$scope = { dirty, ctx };
			}

			loadable.$set(loadable_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(loadable.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(loadable.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(loadable, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot.name,
		type: "slot",
		source: "(50:4) <Route path=\\\"/*\\\" let:meta>",
		ctx
	});

	return block;
}

// (59:6) {#each sections as section}
function create_each_block(ctx) {
	let a;
	let h4;
	let t0_value = /*section*/ ctx[10] + "";
	let t0;
	let t1;
	let a_href_value;

	const block = {
		c: function create() {
			a = element("a");
			h4 = element("h4");
			t0 = text(t0_value);
			t1 = space();
			add_location(h4, file, 64, 10, 1744);
			attr_dev(a, "href", a_href_value = "#" + /*slug*/ ctx[5](/*section*/ ctx[10]));
			attr_dev(a, "tinro-ignore", "");
			attr_dev(a, "class", "svelte-1rp6xr7");
			toggle_class(a, "active", /*$currentSection*/ ctx[3] == /*slug*/ ctx[5](/*section*/ ctx[10]));
			add_location(a, file, 59, 8, 1606);
		},
		m: function mount(target, anchor) {
			insert_dev(target, a, anchor);
			append_dev(a, h4);
			append_dev(h4, t0);
			append_dev(a, t1);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*sections*/ 1 && t0_value !== (t0_value = /*section*/ ctx[10] + "")) set_data_dev(t0, t0_value);

			if (dirty & /*sections*/ 1 && a_href_value !== (a_href_value = "#" + /*slug*/ ctx[5](/*section*/ ctx[10]))) {
				attr_dev(a, "href", a_href_value);
			}

			if (dirty & /*$currentSection, slug, sections*/ 41) {
				toggle_class(a, "active", /*$currentSection*/ ctx[3] == /*slug*/ ctx[5](/*section*/ ctx[10]));
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(a);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block.name,
		type: "each",
		source: "(59:6) {#each sections as section}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let nav;
	let updating_menuOpen;
	let t0;
	let div2;
	let sidenav;
	let updating_currentVariant;
	let t1;
	let main;
	let route;
	let t2;
	let div1;
	let div0;
	let h3;
	let t4;
	let current;

	function nav_menuOpen_binding(value) {
		/*nav_menuOpen_binding*/ ctx[7](value);
	}

	let nav_props = {};

	if (/*menuOpen*/ ctx[1] !== void 0) {
		nav_props.menuOpen = /*menuOpen*/ ctx[1];
	}

	nav = new Nav({ props: nav_props, $$inline: true });
	binding_callbacks.push(() => bind(nav, "menuOpen", nav_menuOpen_binding));

	function sidenav_currentVariant_binding(value) {
		/*sidenav_currentVariant_binding*/ ctx[8](value);
	}

	let sidenav_props = { menuOpen: /*menuOpen*/ ctx[1] };

	if (/*currentVariant*/ ctx[2] !== void 0) {
		sidenav_props.currentVariant = /*currentVariant*/ ctx[2];
	}

	sidenav = new SideNav({ props: sidenav_props, $$inline: true });
	binding_callbacks.push(() => bind(sidenav, "currentVariant", sidenav_currentVariant_binding));

	route = new Route({
			props: {
				path: "/*",
				$$slots: {
					default: [
						create_default_slot,
						({ meta }) => ({ 13: meta }),
						({ meta }) => meta ? 8192 : 0
					]
				},
				$$scope: { ctx }
			},
			$$inline: true
		});

	let each_value = /*sections*/ ctx[0];
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const block = {
		c: function create() {
			create_component(nav.$$.fragment);
			t0 = space();
			div2 = element("div");
			create_component(sidenav.$$.fragment);
			t1 = space();
			main = element("main");
			create_component(route.$$.fragment);
			t2 = space();
			div1 = element("div");
			div0 = element("div");
			h3 = element("h3");
			h3.textContent = "Sections";
			t4 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr_dev(main, "class", "svelte-1rp6xr7");
			add_location(main, file, 48, 2, 1293);
			attr_dev(h3, "class", "svelte-1rp6xr7");
			add_location(h3, file, 57, 6, 1546);
			attr_dev(div0, "class", "sticky svelte-1rp6xr7");
			add_location(div0, file, 56, 4, 1519);
			attr_dev(div1, "class", "headnav svelte-1rp6xr7");
			add_location(div1, file, 55, 2, 1493);
			attr_dev(div2, "class", "page svelte-1rp6xr7");
			add_location(div2, file, 46, 0, 1227);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			mount_component(nav, target, anchor);
			insert_dev(target, t0, anchor);
			insert_dev(target, div2, anchor);
			mount_component(sidenav, div2, null);
			append_dev(div2, t1);
			append_dev(div2, main);
			mount_component(route, main, null);
			append_dev(div2, t2);
			append_dev(div2, div1);
			append_dev(div1, div0);
			append_dev(div0, h3);
			append_dev(div0, t4);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			const nav_changes = {};

			if (!updating_menuOpen && dirty & /*menuOpen*/ 2) {
				updating_menuOpen = true;
				nav_changes.menuOpen = /*menuOpen*/ ctx[1];
				add_flush_callback(() => updating_menuOpen = false);
			}

			nav.$set(nav_changes);
			const sidenav_changes = {};
			if (dirty & /*menuOpen*/ 2) sidenav_changes.menuOpen = /*menuOpen*/ ctx[1];

			if (!updating_currentVariant && dirty & /*currentVariant*/ 4) {
				updating_currentVariant = true;
				sidenav_changes.currentVariant = /*currentVariant*/ ctx[2];
				add_flush_callback(() => updating_currentVariant = false);
			}

			sidenav.$set(sidenav_changes);
			const route_changes = {};

			if (dirty & /*$$scope, meta, sections*/ 40961) {
				route_changes.$$scope = { dirty, ctx };
			}

			route.$set(route_changes);

			if (dirty & /*slug, sections, $currentSection*/ 41) {
				each_value = /*sections*/ ctx[0];
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(nav.$$.fragment, local);
			transition_in(sidenav.$$.fragment, local);
			transition_in(route.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(nav.$$.fragment, local);
			transition_out(sidenav.$$.fragment, local);
			transition_out(route.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(nav, detaching);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(div2);
			destroy_component(sidenav);
			destroy_component(route);
			destroy_each(each_blocks, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance($$self, $$props, $$invalidate) {
	let $currentSection;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("App", slots, []);
	const currentSection = writable(null);
	validate_store(currentSection, "currentSection");
	component_subscribe($$self, currentSection, value => $$invalidate(3, $currentSection = value));
	setContext(keys.currentSection, currentSection);
	let sections = [];
	let menuOpen = false;
	let currentVariant = null;
	const slug = title => slugify(title).toLowerCase();

	const getComponent = () => async () => {
		const { default: meta } = await dynamicImport(`./meta/${currentVariant}.json`);
		console.log({ meta });
		return await import('./index-a1d7daa8.js');
	};

	onMount(() => {
		$$invalidate(1, menuOpen = window.innerWidth > 640);
	});

	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
	});

	function nav_menuOpen_binding(value) {
		menuOpen = value;
		$$invalidate(1, menuOpen);
	}

	function sidenav_currentVariant_binding(value) {
		currentVariant = value;
		$$invalidate(2, currentVariant);
	}

	function switch_instance_sections_binding(value) {
		sections = value;
		$$invalidate(0, sections);
	}

	$$self.$capture_state = () => ({
		Nav,
		SideNav,
		Route,
		onMount,
		Loadable,
		dynamicImport,
		slugify,
		writable,
		setContext,
		keys,
		currentSection,
		sections,
		menuOpen,
		currentVariant,
		slug,
		getComponent,
		$currentSection
	});

	$$self.$inject_state = $$props => {
		if ("sections" in $$props) $$invalidate(0, sections = $$props.sections);
		if ("menuOpen" in $$props) $$invalidate(1, menuOpen = $$props.menuOpen);
		if ("currentVariant" in $$props) $$invalidate(2, currentVariant = $$props.currentVariant);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		sections,
		menuOpen,
		currentVariant,
		$currentSection,
		currentSection,
		slug,
		getComponent,
		nav_menuOpen_binding,
		sidenav_currentVariant_binding,
		switch_instance_sections_binding
	];
}

class App extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance, create_fragment, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "App",
			options,
			id: create_fragment.name
		});
	}
}

const app = new App({
  target: document.body,
});

export { append_dev as A, action_destroyer as B, set_data_dev as C, toggle_class as D, create_slot as E, update_slot as F, commonjsGlobal as G, null_to_empty as H, global$1 as I, getAugmentedNamespace as J, globals as K, listen_dev as L, empty as M, setContext as N, tabsContext as O, writable as P, set_style as Q, app as R, SvelteComponentDev as S, validate_store as a, slugify as b, component_subscribe as c, dispatch_dev as d, set_store_value as e, create_component as f, getContext as g, transition_out as h, init as i, destroy_component as j, keys as k, space as l, mount_component as m, noop as n, onMount as o, element as p, attr_dev as q, add_location as r, safe_not_equal as s, transition_in as t, insert_dev as u, validate_slots as v, group_outros as w, check_outros as x, detach_dev as y, text as z };
//# sourceMappingURL=main-5818d320.js.map
