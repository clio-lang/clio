
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
import { c as commonjsGlobal, S as SvelteComponentDev, i as init, s as safe_not_equal, d as dispatch_dev, v as validate_slots, n as noop$1, g as getContext, k as keys, a as validate_store, b as component_subscribe, o as onMount, e as set_store_value, f as create_component, m as mount_component, t as transition_in, h as transition_out, j as destroy_component, l as space, p as element, q as attr_dev, r as add_location, u as insert_dev, w as group_outros, x as check_outros, y as detach_dev, z as text, A as append_dev, B as action_destroyer, C as set_data_dev, D as toggle_class, E as create_slot, F as update_slot, G as null_to_empty, H as global, I as getAugmentedNamespace, J as globals, K as listen_dev, L as empty, M as setContext, N as tabsContext, O as writable, P as set_style } from './main-d5b78e36.js';

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

/* src/components/PageTitle.svelte generated by Svelte v3.38.2 */

function create_fragment$p(ctx) {
	let title_value;
	document.title = title_value = /*title*/ ctx[0];

	const block = {
		c: noop$1,
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: noop$1,
		p: function update(ctx, [dirty]) {
			if (dirty & /*title*/ 1 && title_value !== (title_value = /*title*/ ctx[0])) {
				document.title = title_value;
			}
		},
		i: noop$1,
		o: noop$1,
		d: noop$1
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$p.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$p($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("PageTitle", slots, []);
	let { title = "" } = $$props;
	const writable_props = ["title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PageTitle> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("title" in $$props) $$invalidate(0, title = $$props.title);
	};

	$$self.$capture_state = () => ({ title });

	$$self.$inject_state = $$props => {
		if ("title" in $$props) $$invalidate(0, title = $$props.title);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [title];
}

class PageTitle extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$p, create_fragment$p, safe_not_equal, { title: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "PageTitle",
			options,
			id: create_fragment$p.name
		});
	}

	get title() {
		throw new Error("<PageTitle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<PageTitle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/Title.svelte generated by Svelte v3.38.2 */
const file$n = "src/components/Title.svelte";

// (37:0) {#if level == 1}
function create_if_block_5(ctx) {
	let pagetitle;
	let current;

	pagetitle = new PageTitle({
			props: { title: /*title*/ ctx[1] },
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(pagetitle.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(pagetitle, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const pagetitle_changes = {};
			if (dirty & /*title*/ 2) pagetitle_changes.title = /*title*/ ctx[1];
			pagetitle.$set(pagetitle_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(pagetitle.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(pagetitle.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(pagetitle, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_5.name,
		type: "if",
		source: "(37:0) {#if level == 1}",
		ctx
	});

	return block;
}

// (50:23) 
function create_if_block_4(ctx) {
	let h5;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h5 = element("h5");
			t = text(/*title*/ ctx[1]);
			attr_dev(h5, "class", "title svelte-v2z8fv");
			add_location(h5, file$n, 50, 4, 1151);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h5, anchor);
			append_dev(h5, t);

			if (!mounted) {
				dispose = action_destroyer(/*observe*/ ctx[4].call(null, h5));
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*title*/ 2) set_data_dev(t, /*title*/ ctx[1]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h5);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_4.name,
		type: "if",
		source: "(50:23) ",
		ctx
	});

	return block;
}

// (48:23) 
function create_if_block_3(ctx) {
	let h4;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h4 = element("h4");
			t = text(/*title*/ ctx[1]);
			attr_dev(h4, "class", "title svelte-v2z8fv");
			add_location(h4, file$n, 48, 4, 1080);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h4, anchor);
			append_dev(h4, t);

			if (!mounted) {
				dispose = action_destroyer(/*observe*/ ctx[4].call(null, h4));
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*title*/ 2) set_data_dev(t, /*title*/ ctx[1]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h4);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_3.name,
		type: "if",
		source: "(48:23) ",
		ctx
	});

	return block;
}

// (46:23) 
function create_if_block_2(ctx) {
	let h3;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h3 = element("h3");
			t = text(/*title*/ ctx[1]);
			attr_dev(h3, "class", "title svelte-v2z8fv");
			add_location(h3, file$n, 46, 4, 1009);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h3, anchor);
			append_dev(h3, t);

			if (!mounted) {
				dispose = action_destroyer(/*observe*/ ctx[4].call(null, h3));
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*title*/ 2) set_data_dev(t, /*title*/ ctx[1]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h3);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_2.name,
		type: "if",
		source: "(46:23) ",
		ctx
	});

	return block;
}

// (44:23) 
function create_if_block_1$2(ctx) {
	let h2;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h2 = element("h2");
			t = text(/*title*/ ctx[1]);
			attr_dev(h2, "class", "title svelte-v2z8fv");
			add_location(h2, file$n, 44, 4, 938);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h2, anchor);
			append_dev(h2, t);

			if (!mounted) {
				dispose = action_destroyer(/*observe*/ ctx[4].call(null, h2));
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*title*/ 2) set_data_dev(t, /*title*/ ctx[1]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h2);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1$2.name,
		type: "if",
		source: "(44:23) ",
		ctx
	});

	return block;
}

// (42:2) {#if level == 1}
function create_if_block$4(ctx) {
	let h1;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h1 = element("h1");
			t = text(/*title*/ ctx[1]);
			attr_dev(h1, "class", "title svelte-v2z8fv");
			add_location(h1, file$n, 42, 4, 867);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h1, anchor);
			append_dev(h1, t);

			if (!mounted) {
				dispose = action_destroyer(/*observe*/ ctx[4].call(null, h1));
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*title*/ 2) set_data_dev(t, /*title*/ ctx[1]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h1);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$4.name,
		type: "if",
		source: "(42:2) {#if level == 1}",
		ctx
	});

	return block;
}

function create_fragment$o(ctx) {
	let t0;
	let a;
	let t1;
	let div;
	let current;
	let if_block0 = /*level*/ ctx[0] == 1 && create_if_block_5(ctx);

	function select_block_type(ctx, dirty) {
		if (/*level*/ ctx[0] == 1) return create_if_block$4;
		if (/*level*/ ctx[0] == 2) return create_if_block_1$2;
		if (/*level*/ ctx[0] == 3) return create_if_block_2;
		if (/*level*/ ctx[0] == 4) return create_if_block_3;
		if (/*level*/ ctx[0] == 5) return create_if_block_4;
	}

	let current_block_type = select_block_type(ctx);
	let if_block1 = current_block_type && current_block_type(ctx);

	const block = {
		c: function create() {
			if (if_block0) if_block0.c();
			t0 = space();
			a = element("a");
			if (if_block1) if_block1.c();
			t1 = space();
			div = element("div");
			attr_dev(a, "href", "#" + /*slug*/ ctx[3]);
			attr_dev(a, "id", /*slug*/ ctx[3]);
			attr_dev(a, "class", "svelte-v2z8fv");
			add_location(a, file$n, 40, 0, 815);
			attr_dev(div, "class", "bar svelte-v2z8fv");
			add_location(div, file$n, 53, 0, 1207);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if (if_block0) if_block0.m(target, anchor);
			insert_dev(target, t0, anchor);
			insert_dev(target, a, anchor);
			if (if_block1) if_block1.m(a, null);
			insert_dev(target, t1, anchor);
			insert_dev(target, div, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (/*level*/ ctx[0] == 1) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty & /*level*/ 1) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_5(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(t0.parentNode, t0);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
				if_block1.p(ctx, dirty);
			} else {
				if (if_block1) if_block1.d(1);
				if_block1 = current_block_type && current_block_type(ctx);

				if (if_block1) {
					if_block1.c();
					if_block1.m(a, null);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block0);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block0);
			current = false;
		},
		d: function destroy(detaching) {
			if (if_block0) if_block0.d(detaching);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(a);

			if (if_block1) {
				if_block1.d();
			}

			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(div);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$o.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$o($$self, $$props, $$invalidate) {
	let $currentSection;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Title", slots, []);
	let { level = 1 } = $$props;
	let { title } = $$props;
	const currentSection = getContext(keys.currentSection);
	validate_store(currentSection, "currentSection");
	component_subscribe($$self, currentSection, value => $$invalidate(6, $currentSection = value));
	const slug = slugify(title).toLowerCase();
	let observer;

	const setCurrent = entries => {
		if (entries[0].boundingClientRect.y < 0) {
			set_store_value(currentSection, $currentSection = slug, $currentSection);
		}
	};

	const observe = el => {
		document.addEventListener("readystatechange", () => {
			observer = new IntersectionObserver(setCurrent, {});
			observer.observe(el);
		});
	};

	onMount(() => () => {
		observer?.disconnect();
	});

	if (level === 1) set_store_value(currentSection, $currentSection = slug, $currentSection);
	const writable_props = ["level", "title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Title> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("level" in $$props) $$invalidate(0, level = $$props.level);
		if ("title" in $$props) $$invalidate(1, title = $$props.title);
	};

	$$self.$capture_state = () => ({
		getContext,
		onMount,
		keys,
		slugify,
		PageTitle,
		level,
		title,
		currentSection,
		slug,
		observer,
		setCurrent,
		observe,
		$currentSection
	});

	$$self.$inject_state = $$props => {
		if ("level" in $$props) $$invalidate(0, level = $$props.level);
		if ("title" in $$props) $$invalidate(1, title = $$props.title);
		if ("observer" in $$props) observer = $$props.observer;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [level, title, currentSection, slug, observe];
}

class Title extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$o, create_fragment$o, safe_not_equal, { level: 0, title: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Title",
			options,
			id: create_fragment$o.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*title*/ ctx[1] === undefined && !("title" in props)) {
			console.warn("<Title> was created without expected prop 'title'");
		}
	}

	get level() {
		throw new Error("<Title>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set level(value) {
		throw new Error("<Title>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get title() {
		throw new Error("<Title>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<Title>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/Image.svelte generated by Svelte v3.38.2 */

const file$m = "src/components/Image.svelte";

function create_fragment$n(ctx) {
	let img;
	let img_src_value;

	const block = {
		c: function create() {
			img = element("img");
			if (img.src !== (img_src_value = /*src*/ ctx[0])) attr_dev(img, "src", img_src_value);
			attr_dev(img, "alt", /*alt*/ ctx[1]);
			attr_dev(img, "class", "svelte-giz3xa");
			toggle_class(img, "inline", /*inline*/ ctx[2]);
			add_location(img, file$m, 7, 0, 86);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, img, anchor);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*src*/ 1 && img.src !== (img_src_value = /*src*/ ctx[0])) {
				attr_dev(img, "src", img_src_value);
			}

			if (dirty & /*alt*/ 2) {
				attr_dev(img, "alt", /*alt*/ ctx[1]);
			}

			if (dirty & /*inline*/ 4) {
				toggle_class(img, "inline", /*inline*/ ctx[2]);
			}
		},
		i: noop$1,
		o: noop$1,
		d: function destroy(detaching) {
			if (detaching) detach_dev(img);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$n.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$n($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Image", slots, []);
	let { src } = $$props;
	let { alt } = $$props;
	let { inline = false } = $$props;
	const writable_props = ["src", "alt", "inline"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Image> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("src" in $$props) $$invalidate(0, src = $$props.src);
		if ("alt" in $$props) $$invalidate(1, alt = $$props.alt);
		if ("inline" in $$props) $$invalidate(2, inline = $$props.inline);
	};

	$$self.$capture_state = () => ({ src, alt, inline });

	$$self.$inject_state = $$props => {
		if ("src" in $$props) $$invalidate(0, src = $$props.src);
		if ("alt" in $$props) $$invalidate(1, alt = $$props.alt);
		if ("inline" in $$props) $$invalidate(2, inline = $$props.inline);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [src, alt, inline];
}

class Image extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$n, create_fragment$n, safe_not_equal, { src: 0, alt: 1, inline: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Image",
			options,
			id: create_fragment$n.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*src*/ ctx[0] === undefined && !("src" in props)) {
			console.warn("<Image> was created without expected prop 'src'");
		}

		if (/*alt*/ ctx[1] === undefined && !("alt" in props)) {
			console.warn("<Image> was created without expected prop 'alt'");
		}
	}

	get src() {
		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set src(value) {
		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get alt() {
		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set alt(value) {
		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get inline() {
		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set inline(value) {
		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/Bold.svelte generated by Svelte v3.38.2 */

const file$l = "src/components/Bold.svelte";

function create_fragment$m(ctx) {
	let b;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			b = element("b");
			if (default_slot) default_slot.c();
			add_location(b, file$l, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, b, anchor);

			if (default_slot) {
				default_slot.m(b, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(b);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$m.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$m($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Bold", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Bold> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Bold extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$m, create_fragment$m, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Bold",
			options,
			id: create_fragment$m.name
		});
	}
}

/* src/components/Italic.svelte generated by Svelte v3.38.2 */

const file$k = "src/components/Italic.svelte";

function create_fragment$l(ctx) {
	let i;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			i = element("i");
			if (default_slot) default_slot.c();
			add_location(i, file$k, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, i, anchor);

			if (default_slot) {
				default_slot.m(i, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(i);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$l.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$l($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Italic", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Italic> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Italic extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$l, create_fragment$l, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Italic",
			options,
			id: create_fragment$l.name
		});
	}
}

/* src/components/Paragraph.svelte generated by Svelte v3.38.2 */

const file$j = "src/components/Paragraph.svelte";

function create_fragment$k(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr_dev(div, "class", "paragraph svelte-1w6fwgd");
			add_location(div, file$j, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$k.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$k($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Paragraph", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Paragraph> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Paragraph extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$k, create_fragment$k, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Paragraph",
			options,
			id: create_fragment$k.name
		});
	}
}

/* src/components/Link.svelte generated by Svelte v3.38.2 */

const file$i = "src/components/Link.svelte";

function create_fragment$j(ctx) {
	let a;
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

	const block = {
		c: function create() {
			a = element("a");
			if (default_slot) default_slot.c();
			attr_dev(a, "href", /*href*/ ctx[0]);
			add_location(a, file$i, 5, 0, 40);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, a, anchor);

			if (default_slot) {
				default_slot.m(a, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
				}
			}

			if (!current || dirty & /*href*/ 1) {
				attr_dev(a, "href", /*href*/ ctx[0]);
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
			if (detaching) detach_dev(a);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$j.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$j($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Link", slots, ['default']);
	let { href } = $$props;
	const writable_props = ["href"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Link> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("href" in $$props) $$invalidate(0, href = $$props.href);
		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ href });

	$$self.$inject_state = $$props => {
		if ("href" in $$props) $$invalidate(0, href = $$props.href);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [href, $$scope, slots];
}

class Link extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$j, create_fragment$j, safe_not_equal, { href: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Link",
			options,
			id: create_fragment$j.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*href*/ ctx[0] === undefined && !("href" in props)) {
			console.warn("<Link> was created without expected prop 'href'");
		}
	}

	get href() {
		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set href(value) {
		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

var prism = {exports: {}};

(function (module) {
/* **********************************************
     Begin prism-core.js
********************************************** */

/// <reference lib="WebWorker"/>

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 *
 * @license MIT <https://opensource.org/licenses/MIT>
 * @author Lea Verou <https://lea.verou.me>
 * @namespace
 * @public
 */
var Prism = (function (_self){

// Private helper vars
var lang = /\blang(?:uage)?-([\w-]+)\b/i;
var uniqueId = 0;


var _ = {
	/**
	 * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
	 * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
	 * additional languages or plugins yourself.
	 *
	 * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
	 *
	 * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
	 * empty Prism object into the global scope before loading the Prism script like this:
	 *
	 * ```js
	 * window.Prism = window.Prism || {};
	 * Prism.manual = true;
	 * // add a new <script> to load Prism's script
	 * ```
	 *
	 * @default false
	 * @type {boolean}
	 * @memberof Prism
	 * @public
	 */
	manual: _self.Prism && _self.Prism.manual,
	disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,

	/**
	 * A namespace for utility methods.
	 *
	 * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
	 * change or disappear at any time.
	 *
	 * @namespace
	 * @memberof Prism
	 */
	util: {
		encode: function encode(tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, encode(tokens.content), tokens.alias);
			} else if (Array.isArray(tokens)) {
				return tokens.map(encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		/**
		 * Returns the name of the type of the given value.
		 *
		 * @param {any} o
		 * @returns {string}
		 * @example
		 * type(null)      === 'Null'
		 * type(undefined) === 'Undefined'
		 * type(123)       === 'Number'
		 * type('foo')     === 'String'
		 * type(true)      === 'Boolean'
		 * type([1, 2])    === 'Array'
		 * type({})        === 'Object'
		 * type(String)    === 'Function'
		 * type(/abc+/)    === 'RegExp'
		 */
		type: function (o) {
			return Object.prototype.toString.call(o).slice(8, -1);
		},

		/**
		 * Returns a unique number for the given object. Later calls will still return the same number.
		 *
		 * @param {Object} obj
		 * @returns {number}
		 */
		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		/**
		 * Creates a deep clone of the given object.
		 *
		 * The main intended use of this function is to clone language definitions.
		 *
		 * @param {T} o
		 * @param {Record<number, any>} [visited]
		 * @returns {T}
		 * @template T
		 */
		clone: function deepClone(o, visited) {
			visited = visited || {};

			var clone, id;
			switch (_.util.type(o)) {
				case 'Object':
					id = _.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = /** @type {Record<string, any>} */ ({});
					visited[id] = clone;

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = deepClone(o[key], visited);
						}
					}

					return /** @type {any} */ (clone);

				case 'Array':
					id = _.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = [];
					visited[id] = clone;

					(/** @type {Array} */(/** @type {any} */(o))).forEach(function (v, i) {
						clone[i] = deepClone(v, visited);
					});

					return /** @type {any} */ (clone);

				default:
					return o;
			}
		},

		/**
		 * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
		 *
		 * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
		 *
		 * @param {Element} element
		 * @returns {string}
		 */
		getLanguage: function (element) {
			while (element && !lang.test(element.className)) {
				element = element.parentElement;
			}
			if (element) {
				return (element.className.match(lang) || [, 'none'])[1].toLowerCase();
			}
			return 'none';
		},

		/**
		 * Returns the script element that is currently executing.
		 *
		 * This does __not__ work for line script element.
		 *
		 * @returns {HTMLScriptElement | null}
		 */
		currentScript: function () {
			if (typeof document === 'undefined') {
				return null;
			}
			if ('currentScript' in document && 1 < 2 /* hack to trip TS' flow analysis */) {
				return /** @type {any} */ (document.currentScript);
			}

			// IE11 workaround
			// we'll get the src of the current script by parsing IE11's error stack trace
			// this will not work for inline scripts

			try {
				throw new Error();
			} catch (err) {
				// Get file src url from stack. Specifically works with the format of stack traces in IE.
				// A stack will look like this:
				//
				// Error
				//    at _.util.currentScript (http://localhost/components/prism-core.js:119:5)
				//    at Global code (http://localhost/components/prism-core.js:606:1)

				var src = (/at [^(\r\n]*\((.*):.+:.+\)$/i.exec(err.stack) || [])[1];
				if (src) {
					var scripts = document.getElementsByTagName('script');
					for (var i in scripts) {
						if (scripts[i].src == src) {
							return scripts[i];
						}
					}
				}
				return null;
			}
		},

		/**
		 * Returns whether a given class is active for `element`.
		 *
		 * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
		 * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
		 * given class is just the given class with a `no-` prefix.
		 *
		 * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
		 * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
		 * ancestors have the given class or the negated version of it, then the default activation will be returned.
		 *
		 * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
		 * version of it, the class is considered active.
		 *
		 * @param {Element} element
		 * @param {string} className
		 * @param {boolean} [defaultActivation=false]
		 * @returns {boolean}
		 */
		isActive: function (element, className, defaultActivation) {
			var no = 'no-' + className;

			while (element) {
				var classList = element.classList;
				if (classList.contains(className)) {
					return true;
				}
				if (classList.contains(no)) {
					return false;
				}
				element = element.parentElement;
			}
			return !!defaultActivation;
		}
	},

	/**
	 * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
	 *
	 * @namespace
	 * @memberof Prism
	 * @public
	 */
	languages: {
		/**
		 * Creates a deep copy of the language with the given id and appends the given tokens.
		 *
		 * If a token in `redef` also appears in the copied language, then the existing token in the copied language
		 * will be overwritten at its original position.
		 *
		 * ## Best practices
		 *
		 * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
		 * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
		 * understand the language definition because, normally, the order of tokens matters in Prism grammars.
		 *
		 * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
		 * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
		 *
		 * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
		 * @param {Grammar} redef The new tokens to append.
		 * @returns {Grammar} The new language created.
		 * @public
		 * @example
		 * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
		 *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
		 *     // at its original position
		 *     'comment': { ... },
		 *     // CSS doesn't have a 'color' token, so this token will be appended
		 *     'color': /\b(?:red|green|blue)\b/
		 * });
		 */
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Inserts tokens _before_ another token in a language definition or any other grammar.
		 *
		 * ## Usage
		 *
		 * This helper method makes it easy to modify existing languages. For example, the CSS language definition
		 * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
		 * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
		 * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
		 * this:
		 *
		 * ```js
		 * Prism.languages.markup.style = {
		 *     // token
		 * };
		 * ```
		 *
		 * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
		 * before existing tokens. For the CSS example above, you would use it like this:
		 *
		 * ```js
		 * Prism.languages.insertBefore('markup', 'cdata', {
		 *     'style': {
		 *         // token
		 *     }
		 * });
		 * ```
		 *
		 * ## Special cases
		 *
		 * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
		 * will be ignored.
		 *
		 * This behavior can be used to insert tokens after `before`:
		 *
		 * ```js
		 * Prism.languages.insertBefore('markup', 'comment', {
		 *     'comment': Prism.languages.markup.comment,
		 *     // tokens after 'comment'
		 * });
		 * ```
		 *
		 * ## Limitations
		 *
		 * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
		 * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
		 * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
		 * deleting properties which is necessary to insert at arbitrary positions.
		 *
		 * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
		 * Instead, it will create a new object and replace all references to the target object with the new one. This
		 * can be done without temporarily deleting properties, so the iteration order is well-defined.
		 *
		 * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
		 * you hold the target object in a variable, then the value of the variable will not change.
		 *
		 * ```js
		 * var oldMarkup = Prism.languages.markup;
		 * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
		 *
		 * assert(oldMarkup !== Prism.languages.markup);
		 * assert(newMarkup === Prism.languages.markup);
		 * ```
		 *
		 * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
		 * object to be modified.
		 * @param {string} before The key to insert before.
		 * @param {Grammar} insert An object containing the key-value pairs to be inserted.
		 * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
		 * object to be modified.
		 *
		 * Defaults to `Prism.languages`.
		 * @returns {Grammar} The new grammar object.
		 * @public
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || /** @type {any} */ (_.languages);
			var grammar = root[inside];
			/** @type {Grammar} */
			var ret = {};

			for (var token in grammar) {
				if (grammar.hasOwnProperty(token)) {

					if (token == before) {
						for (var newToken in insert) {
							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					// Do not insert token which also occur in insert. See #1525
					if (!insert.hasOwnProperty(token)) {
						ret[token] = grammar[token];
					}
				}
			}

			var old = root[inside];
			root[inside] = ret;

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === old && key != inside) {
					this[key] = ret;
				}
			});

			return ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function DFS(o, callback, type, visited) {
			visited = visited || {};

			var objId = _.util.objId;

			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					var property = o[i],
					    propertyType = _.util.type(property);

					if (propertyType === 'Object' && !visited[objId(property)]) {
						visited[objId(property)] = true;
						DFS(property, callback, null, visited);
					}
					else if (propertyType === 'Array' && !visited[objId(property)]) {
						visited[objId(property)] = true;
						DFS(property, callback, i, visited);
					}
				}
			}
		}
	},

	plugins: {},

	/**
	 * This is the most high-level function in Prism’s API.
	 * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
	 * each one of them.
	 *
	 * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
	 *
	 * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
	 * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
	 * @memberof Prism
	 * @public
	 */
	highlightAll: function(async, callback) {
		_.highlightAllUnder(document, async, callback);
	},

	/**
	 * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
	 * {@link Prism.highlightElement} on each one of them.
	 *
	 * The following hooks will be run:
	 * 1. `before-highlightall`
	 * 2. `before-all-elements-highlight`
	 * 3. All hooks of {@link Prism.highlightElement} for each element.
	 *
	 * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
	 * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
	 * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
	 * @memberof Prism
	 * @public
	 */
	highlightAllUnder: function(container, async, callback) {
		var env = {
			callback: callback,
			container: container,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run('before-highlightall', env);

		env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));

		_.hooks.run('before-all-elements-highlight', env);

		for (var i = 0, element; element = env.elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	/**
	 * Highlights the code inside a single element.
	 *
	 * The following hooks will be run:
	 * 1. `before-sanity-check`
	 * 2. `before-highlight`
	 * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
	 * 4. `before-insert`
	 * 5. `after-highlight`
	 * 6. `complete`
	 *
	 * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
	 * the element's language.
	 *
	 * @param {Element} element The element containing the code.
	 * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
	 * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
	 * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
	 * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
	 *
	 * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
	 * asynchronous highlighting to work. You can build your own bundle on the
	 * [Download page](https://prismjs.com/download.html).
	 * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
	 * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
	 * @memberof Prism
	 * @public
	 */
	highlightElement: function(element, async, callback) {
		// Find language
		var language = _.util.getLanguage(element);
		var grammar = _.languages[language];

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		var parent = element.parentElement;
		if (parent && parent.nodeName.toLowerCase() === 'pre') {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		function insertHighlightedCode(highlightedCode) {
			env.highlightedCode = highlightedCode;

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
			callback && callback.call(env.element);
		}

		_.hooks.run('before-sanity-check', env);

		if (!env.code) {
			_.hooks.run('complete', env);
			callback && callback.call(env.element);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (!env.grammar) {
			insertHighlightedCode(_.util.encode(env.code));
			return;
		}

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				insertHighlightedCode(evt.data);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
		}
	},

	/**
	 * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
	 * and the language definitions to use, and returns a string with the HTML produced.
	 *
	 * The following hooks will be run:
	 * 1. `before-tokenize`
	 * 2. `after-tokenize`
	 * 3. `wrap`: On each {@link Token}.
	 *
	 * @param {string} text A string with the code to be highlighted.
	 * @param {Grammar} grammar An object containing the tokens to use.
	 *
	 * Usually a language definition like `Prism.languages.markup`.
	 * @param {string} language The name of the language definition passed to `grammar`.
	 * @returns {string} The highlighted HTML.
	 * @memberof Prism
	 * @public
	 * @example
	 * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
	 */
	highlight: function (text, grammar, language) {
		var env = {
			code: text,
			grammar: grammar,
			language: language
		};
		_.hooks.run('before-tokenize', env);
		env.tokens = _.tokenize(env.code, env.grammar);
		_.hooks.run('after-tokenize', env);
		return Token.stringify(_.util.encode(env.tokens), env.language);
	},

	/**
	 * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
	 * and the language definitions to use, and returns an array with the tokenized code.
	 *
	 * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
	 *
	 * This method could be useful in other contexts as well, as a very crude parser.
	 *
	 * @param {string} text A string with the code to be highlighted.
	 * @param {Grammar} grammar An object containing the tokens to use.
	 *
	 * Usually a language definition like `Prism.languages.markup`.
	 * @returns {TokenStream} An array of strings and tokens, a token stream.
	 * @memberof Prism
	 * @public
	 * @example
	 * let code = `var foo = 0;`;
	 * let tokens = Prism.tokenize(code, Prism.languages.javascript);
	 * tokens.forEach(token => {
	 *     if (token instanceof Prism.Token && token.type === 'number') {
	 *         console.log(`Found numeric literal: ${token.content}`);
	 *     }
	 * });
	 */
	tokenize: function(text, grammar) {
		var rest = grammar.rest;
		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		var tokenList = new LinkedList();
		addAfter(tokenList, tokenList.head, text);

		matchGrammar(text, tokenList, grammar, tokenList.head, 0);

		return toArray(tokenList);
	},

	/**
	 * @namespace
	 * @memberof Prism
	 * @public
	 */
	hooks: {
		all: {},

		/**
		 * Adds the given callback to the list of callbacks for the given hook.
		 *
		 * The callback will be invoked when the hook it is registered for is run.
		 * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
		 *
		 * One callback function can be registered to multiple hooks and the same hook multiple times.
		 *
		 * @param {string} name The name of the hook.
		 * @param {HookCallback} callback The callback function which is given environment variables.
		 * @public
		 */
		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		/**
		 * Runs a hook invoking all registered callbacks with the given environment variables.
		 *
		 * Callbacks will be invoked synchronously and in the order in which they were registered.
		 *
		 * @param {string} name The name of the hook.
		 * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
		 * @public
		 */
		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	},

	Token: Token
};
_self.Prism = _;


// Typescript note:
// The following can be used to import the Token type in JSDoc:
//
//   @typedef {InstanceType<import("./prism-core")["Token"]>} Token

/**
 * Creates a new token.
 *
 * @param {string} type See {@link Token#type type}
 * @param {string | TokenStream} content See {@link Token#content content}
 * @param {string|string[]} [alias] The alias(es) of the token.
 * @param {string} [matchedStr=""] A copy of the full string this token was created from.
 * @class
 * @global
 * @public
 */
function Token(type, content, alias, matchedStr) {
	/**
	 * The type of the token.
	 *
	 * This is usually the key of a pattern in a {@link Grammar}.
	 *
	 * @type {string}
	 * @see GrammarToken
	 * @public
	 */
	this.type = type;
	/**
	 * The strings or tokens contained by this token.
	 *
	 * This will be a token stream if the pattern matched also defined an `inside` grammar.
	 *
	 * @type {string | TokenStream}
	 * @public
	 */
	this.content = content;
	/**
	 * The alias(es) of the token.
	 *
	 * @type {string|string[]}
	 * @see GrammarToken
	 * @public
	 */
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || '').length | 0;
}

/**
 * A token stream is an array of strings and {@link Token Token} objects.
 *
 * Token streams have to fulfill a few properties that are assumed by most functions (mostly internal ones) that process
 * them.
 *
 * 1. No adjacent strings.
 * 2. No empty strings.
 *
 *    The only exception here is the token stream that only contains the empty string and nothing else.
 *
 * @typedef {Array<string | Token>} TokenStream
 * @global
 * @public
 */

/**
 * Converts the given token or token stream to an HTML representation.
 *
 * The following hooks will be run:
 * 1. `wrap`: On each {@link Token}.
 *
 * @param {string | Token | TokenStream} o The token or token stream to be converted.
 * @param {string} language The name of current language.
 * @returns {string} The HTML representation of the token or token stream.
 * @memberof Token
 * @static
 */
Token.stringify = function stringify(o, language) {
	if (typeof o == 'string') {
		return o;
	}
	if (Array.isArray(o)) {
		var s = '';
		o.forEach(function (e) {
			s += stringify(e, language);
		});
		return s;
	}

	var env = {
		type: o.type,
		content: stringify(o.content, language),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language
	};

	var aliases = o.alias;
	if (aliases) {
		if (Array.isArray(aliases)) {
			Array.prototype.push.apply(env.classes, aliases);
		} else {
			env.classes.push(aliases);
		}
	}

	_.hooks.run('wrap', env);

	var attributes = '';
	for (var name in env.attributes) {
		attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
};

/**
 * @param {RegExp} pattern
 * @param {number} pos
 * @param {string} text
 * @param {boolean} lookbehind
 * @returns {RegExpExecArray | null}
 */
function matchPattern(pattern, pos, text, lookbehind) {
	pattern.lastIndex = pos;
	var match = pattern.exec(text);
	if (match && lookbehind && match[1]) {
		// change the match to remove the text matched by the Prism lookbehind group
		var lookbehindLength = match[1].length;
		match.index += lookbehindLength;
		match[0] = match[0].slice(lookbehindLength);
	}
	return match;
}

/**
 * @param {string} text
 * @param {LinkedList<string | Token>} tokenList
 * @param {any} grammar
 * @param {LinkedListNode<string | Token>} startNode
 * @param {number} startPos
 * @param {RematchOptions} [rematch]
 * @returns {void}
 * @private
 *
 * @typedef RematchOptions
 * @property {string} cause
 * @property {number} reach
 */
function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
	for (var token in grammar) {
		if (!grammar.hasOwnProperty(token) || !grammar[token]) {
			continue;
		}

		var patterns = grammar[token];
		patterns = Array.isArray(patterns) ? patterns : [patterns];

		for (var j = 0; j < patterns.length; ++j) {
			if (rematch && rematch.cause == token + ',' + j) {
				return;
			}

			var patternObj = patterns[j],
				inside = patternObj.inside,
				lookbehind = !!patternObj.lookbehind,
				greedy = !!patternObj.greedy,
				alias = patternObj.alias;

			if (greedy && !patternObj.pattern.global) {
				// Without the global flag, lastIndex won't work
				var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
				patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
			}

			/** @type {RegExp} */
			var pattern = patternObj.pattern || patternObj;

			for ( // iterate the token list and keep track of the current token/string position
				var currentNode = startNode.next, pos = startPos;
				currentNode !== tokenList.tail;
				pos += currentNode.value.length, currentNode = currentNode.next
			) {

				if (rematch && pos >= rematch.reach) {
					break;
				}

				var str = currentNode.value;

				if (tokenList.length > text.length) {
					// Something went terribly wrong, ABORT, ABORT!
					return;
				}

				if (str instanceof Token) {
					continue;
				}

				var removeCount = 1; // this is the to parameter of removeBetween
				var match;

				if (greedy) {
					match = matchPattern(pattern, pos, text, lookbehind);
					if (!match) {
						break;
					}

					var from = match.index;
					var to = match.index + match[0].length;
					var p = pos;

					// find the node that contains the match
					p += currentNode.value.length;
					while (from >= p) {
						currentNode = currentNode.next;
						p += currentNode.value.length;
					}
					// adjust pos (and p)
					p -= currentNode.value.length;
					pos = p;

					// the current node is a Token, then the match starts inside another Token, which is invalid
					if (currentNode.value instanceof Token) {
						continue;
					}

					// find the last node which is affected by this match
					for (
						var k = currentNode;
						k !== tokenList.tail && (p < to || typeof k.value === 'string');
						k = k.next
					) {
						removeCount++;
						p += k.value.length;
					}
					removeCount--;

					// replace with the new match
					str = text.slice(pos, p);
					match.index -= pos;
				} else {
					match = matchPattern(pattern, 0, str, lookbehind);
					if (!match) {
						continue;
					}
				}

				var from = match.index,
					matchStr = match[0],
					before = str.slice(0, from),
					after = str.slice(from + matchStr.length);

				var reach = pos + str.length;
				if (rematch && reach > rematch.reach) {
					rematch.reach = reach;
				}

				var removeFrom = currentNode.prev;

				if (before) {
					removeFrom = addAfter(tokenList, removeFrom, before);
					pos += before.length;
				}

				removeRange(tokenList, removeFrom, removeCount);

				var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
				currentNode = addAfter(tokenList, removeFrom, wrapped);

				if (after) {
					addAfter(tokenList, currentNode, after);
				}

				if (removeCount > 1) {
					// at least one Token object was removed, so we have to do some rematching
					// this can only happen if the current pattern is greedy
					matchGrammar(text, tokenList, grammar, currentNode.prev, pos, {
						cause: token + ',' + j,
						reach: reach
					});
				}
			}
		}
	}
}

/**
 * @typedef LinkedListNode
 * @property {T} value
 * @property {LinkedListNode<T> | null} prev The previous node.
 * @property {LinkedListNode<T> | null} next The next node.
 * @template T
 * @private
 */

/**
 * @template T
 * @private
 */
function LinkedList() {
	/** @type {LinkedListNode<T>} */
	var head = { value: null, prev: null, next: null };
	/** @type {LinkedListNode<T>} */
	var tail = { value: null, prev: head, next: null };
	head.next = tail;

	/** @type {LinkedListNode<T>} */
	this.head = head;
	/** @type {LinkedListNode<T>} */
	this.tail = tail;
	this.length = 0;
}

/**
 * Adds a new node with the given value to the list.
 * @param {LinkedList<T>} list
 * @param {LinkedListNode<T>} node
 * @param {T} value
 * @returns {LinkedListNode<T>} The added node.
 * @template T
 */
function addAfter(list, node, value) {
	// assumes that node != list.tail && values.length >= 0
	var next = node.next;

	var newNode = { value: value, prev: node, next: next };
	node.next = newNode;
	next.prev = newNode;
	list.length++;

	return newNode;
}
/**
 * Removes `count` nodes after the given node. The given node will not be removed.
 * @param {LinkedList<T>} list
 * @param {LinkedListNode<T>} node
 * @param {number} count
 * @template T
 */
function removeRange(list, node, count) {
	var next = node.next;
	for (var i = 0; i < count && next !== list.tail; i++) {
		next = next.next;
	}
	node.next = next;
	next.prev = node;
	list.length -= i;
}
/**
 * @param {LinkedList<T>} list
 * @returns {T[]}
 * @template T
 */
function toArray(list) {
	var array = [];
	var node = list.head.next;
	while (node !== list.tail) {
		array.push(node.value);
		node = node.next;
	}
	return array;
}


if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _;
	}

	if (!_.disableWorkerMessageHandler) {
		// In worker
		_self.addEventListener('message', function (evt) {
			var message = JSON.parse(evt.data),
				lang = message.language,
				code = message.code,
				immediateClose = message.immediateClose;

			_self.postMessage(_.highlight(code, _.languages[lang], lang));
			if (immediateClose) {
				_self.close();
			}
		}, false);
	}

	return _;
}

// Get current script and highlight
var script = _.util.currentScript();

if (script) {
	_.filename = script.src;

	if (script.hasAttribute('data-manual')) {
		_.manual = true;
	}
}

function highlightAutomaticallyCallback() {
	if (!_.manual) {
		_.highlightAll();
	}
}

if (!_.manual) {
	// If the document state is "loading", then we'll use DOMContentLoaded.
	// If the document state is "interactive" and the prism.js script is deferred, then we'll also use the
	// DOMContentLoaded event because there might be some plugins or languages which have also been deferred and they
	// might take longer one animation frame to execute which can create a race condition where only some plugins have
	// been loaded when Prism.highlightAll() is executed, depending on how fast resources are loaded.
	// See https://github.com/PrismJS/prism/issues/2102
	var readyState = document.readyState;
	if (readyState === 'loading' || readyState === 'interactive' && script && script.defer) {
		document.addEventListener('DOMContentLoaded', highlightAutomaticallyCallback);
	} else {
		if (window.requestAnimationFrame) {
			window.requestAnimationFrame(highlightAutomaticallyCallback);
		} else {
			window.setTimeout(highlightAutomaticallyCallback, 16);
		}
	}
}

return _;

})(_self);

if (module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof commonjsGlobal !== 'undefined') {
	commonjsGlobal.Prism = Prism;
}

// some additional documentation/types

/**
 * The expansion of a simple `RegExp` literal to support additional properties.
 *
 * @typedef GrammarToken
 * @property {RegExp} pattern The regular expression of the token.
 * @property {boolean} [lookbehind=false] If `true`, then the first capturing group of `pattern` will (effectively)
 * behave as a lookbehind group meaning that the captured text will not be part of the matched text of the new token.
 * @property {boolean} [greedy=false] Whether the token is greedy.
 * @property {string|string[]} [alias] An optional alias or list of aliases.
 * @property {Grammar} [inside] The nested grammar of this token.
 *
 * The `inside` grammar will be used to tokenize the text value of each token of this kind.
 *
 * This can be used to make nested and even recursive language definitions.
 *
 * Note: This can cause infinite recursion. Be careful when you embed different languages or even the same language into
 * each another.
 * @global
 * @public
*/

/**
 * @typedef Grammar
 * @type {Object<string, RegExp | GrammarToken | Array<RegExp | GrammarToken>>}
 * @property {Grammar} [rest] An optional grammar object that will be appended to this grammar.
 * @global
 * @public
 */

/**
 * A function which will invoked after an element was successfully highlighted.
 *
 * @callback HighlightCallback
 * @param {Element} element The element successfully highlighted.
 * @returns {void}
 * @global
 * @public
*/

/**
 * @callback HookCallback
 * @param {Object<string, any>} env The environment variables of the hook.
 * @returns {void}
 * @global
 * @public
 */


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': {
		// https://www.w3.org/TR/xml/#NT-doctypedecl
		pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
		greedy: true,
		inside: {
			'internal-subset': {
				pattern: /(\[)[\s\S]+(?=\]>$)/,
				lookbehind: true,
				greedy: true,
				inside: null // see below
			},
			'string': {
				pattern: /"[^"]*"|'[^']*'/,
				greedy: true
			},
			'punctuation': /^<!|>$|[[\]]/,
			'doctype-tag': /^DOCTYPE/,
			'name': /[^\s<>'"]+/
		}
	},
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
		greedy: true,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
				inside: {
					'punctuation': [
						{
							pattern: /^=/,
							alias: 'attr-equals'
						},
						/"|'/
					]
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': [
		{
			pattern: /&[\da-z]{1,8};/i,
			alias: 'named-entity'
		},
		/&#x?[\da-f]{1,8};/i
	]
};

Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] =
	Prism.languages.markup['entity'];
Prism.languages.markup['doctype'].inside['internal-subset'].inside = Prism.languages.markup;

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function (env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Object.defineProperty(Prism.languages.markup.tag, 'addInlined', {
	/**
	 * Adds an inlined language to markup.
	 *
	 * An example of an inlined language is CSS with `<style>` tags.
	 *
	 * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addInlined('style', 'css');
	 */
	value: function addInlined(tagName, lang) {
		var includedCdataInside = {};
		includedCdataInside['language-' + lang] = {
			pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
			lookbehind: true,
			inside: Prism.languages[lang]
		};
		includedCdataInside['cdata'] = /^<!\[CDATA\[|\]\]>$/i;

		var inside = {
			'included-cdata': {
				pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
				inside: includedCdataInside
			}
		};
		inside['language-' + lang] = {
			pattern: /[\s\S]+/,
			inside: Prism.languages[lang]
		};

		var def = {};
		def[tagName] = {
			pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function () { return tagName; }), 'i'),
			lookbehind: true,
			greedy: true,
			inside: inside
		};

		Prism.languages.insertBefore('markup', 'cdata', def);
	}
});

Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;

Prism.languages.xml = Prism.languages.extend('markup', {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;


/* **********************************************
     Begin prism-css.js
********************************************** */

(function (Prism) {

	var string = /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;

	Prism.languages.css = {
		'comment': /\/\*[\s\S]*?\*\//,
		'atrule': {
			pattern: /@[\w-](?:[^;{\s]|\s+(?![\s{]))*(?:;|(?=\s*\{))/,
			inside: {
				'rule': /^@[\w-]+/,
				'selector-function-argument': {
					pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
					lookbehind: true,
					alias: 'selector'
				},
				'keyword': {
					pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
					lookbehind: true
				}
				// See rest below
			}
		},
		'url': {
			// https://drafts.csswg.org/css-values-3/#urls
			pattern: RegExp('\\burl\\((?:' + string.source + '|' + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ')\\)', 'i'),
			greedy: true,
			inside: {
				'function': /^url/i,
				'punctuation': /^\(|\)$/,
				'string': {
					pattern: RegExp('^' + string.source + '$'),
					alias: 'url'
				}
			}
		},
		'selector': RegExp('[^{}\\s](?:[^{};"\'\\s]|\\s+(?![\\s{])|' + string.source + ')*(?=\\s*\\{)'),
		'string': {
			pattern: string,
			greedy: true
		},
		'property': /(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
		'important': /!important\b/i,
		'function': /[-a-z0-9]+(?=\()/i,
		'punctuation': /[(){};:,]/
	};

	Prism.languages.css['atrule'].inside.rest = Prism.languages.css;

	var markup = Prism.languages.markup;
	if (markup) {
		markup.tag.addInlined('style', 'css');

		Prism.languages.insertBefore('inside', 'attr-value', {
			'style-attr': {
				pattern: /(^|["'\s])style\s*=\s*(?:"[^"]*"|'[^']*')/i,
				lookbehind: true,
				inside: {
					'attr-value': {
						pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
						inside: {
							'style': {
								pattern: /(["'])[\s\S]+(?=["']$)/,
								lookbehind: true,
								alias: 'language-css',
								inside: Prism.languages.css
							},
							'punctuation': [
								{
									pattern: /^=/,
									alias: 'attr-equals'
								},
								/"|'/
							]
						}
					},
					'attr-name': /^style/i
				}
			}
		}, markup.tag);
	}

}(Prism));


/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true,
			greedy: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true,
			greedy: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /(\b(?:class|interface|extends|implements|trait|instanceof|new)\s+|\bcatch\s+\()[\w.\\]+/i,
		lookbehind: true,
		inside: {
			'punctuation': /[.\\]/
		}
	},
	'keyword': /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(?:true|false)\b/,
	'function': /\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'class-name': [
		Prism.languages.clike['class-name'],
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:prototype|constructor))/,
			lookbehind: true
		}
	],
	'keyword': [
		{
			pattern: /((?:^|})\s*)(?:catch|finally)\b/,
			lookbehind: true
		},
		{
			pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|(?:get|set)(?=\s*[\[$\w\xA0-\uFFFF])|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
			lookbehind: true
		},
	],
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	'number': /\b(?:(?:0[xX](?:[\dA-Fa-f](?:_[\dA-Fa-f])?)+|0[bB](?:[01](?:_[01])?)+|0[oO](?:[0-7](?:_[0-7])?)+)n?|(?:\d(?:_\d)?)+n|NaN|Infinity)\b|(?:\b(?:\d(?:_\d)?)+\.?(?:\d(?:_\d)?)*|\B\.(?:\d(?:_\d)?)+)(?:[Ee][+-]?(?:\d(?:_\d)?)+)?/,
	'operator': /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});

Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/;

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)\/(?:\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyus]{0,6}(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/,
		lookbehind: true,
		greedy: true,
		inside: {
			'regex-source': {
				pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
				lookbehind: true,
				alias: 'language-regex',
				inside: Prism.languages.regex
			},
			'regex-flags': /[a-z]+$/,
			'regex-delimiter': /^\/|\/$/
		}
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
		alias: 'function'
	},
	'parameter': [
		{
			pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		}
	],
	'constant': /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\[\s\S]|\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})+}|(?!\${)[^\\`])*`/,
		greedy: true,
		inside: {
			'template-punctuation': {
				pattern: /^`|`$/,
				alias: 'string'
			},
			'interpolation': {
				pattern: /((?:^|[^\\])(?:\\{2})*)\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})+}/,
				lookbehind: true,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\${|}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.markup.tag.addInlined('script', 'javascript');
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document) {
		return;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
	if (!Element.prototype.matches) {
		Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
	}

	var Prism = window.Prism;

	var LOADING_MESSAGE = 'Loading…';
	var FAILURE_MESSAGE = function (status, message) {
		return '✖ Error ' + status + ' while fetching file: ' + message;
	};
	var FAILURE_EMPTY_MESSAGE = '✖ Error: File does not exist or is empty';

	var EXTENSIONS = {
		'js': 'javascript',
		'py': 'python',
		'rb': 'ruby',
		'ps1': 'powershell',
		'psm1': 'powershell',
		'sh': 'bash',
		'bat': 'batch',
		'h': 'c',
		'tex': 'latex'
	};

	var STATUS_ATTR = 'data-src-status';
	var STATUS_LOADING = 'loading';
	var STATUS_LOADED = 'loaded';
	var STATUS_FAILED = 'failed';

	var SELECTOR = 'pre[data-src]:not([' + STATUS_ATTR + '="' + STATUS_LOADED + '"])'
		+ ':not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';

	var lang = /\blang(?:uage)?-([\w-]+)\b/i;

	/**
	 * Sets the Prism `language-xxxx` or `lang-xxxx` class to the given language.
	 *
	 * @param {HTMLElement} element
	 * @param {string} language
	 * @returns {void}
	 */
	function setLanguageClass(element, language) {
		var className = element.className;
		className = className.replace(lang, ' ') + ' language-' + language;
		element.className = className.replace(/\s+/g, ' ').trim();
	}


	Prism.hooks.add('before-highlightall', function (env) {
		env.selector += ', ' + SELECTOR;
	});

	Prism.hooks.add('before-sanity-check', function (env) {
		var pre = /** @type {HTMLPreElement} */ (env.element);
		if (pre.matches(SELECTOR)) {
			env.code = ''; // fast-path the whole thing and go to complete

			pre.setAttribute(STATUS_ATTR, STATUS_LOADING); // mark as loading

			// add code element with loading message
			var code = pre.appendChild(document.createElement('CODE'));
			code.textContent = LOADING_MESSAGE;

			var src = pre.getAttribute('data-src');

			var language = env.language;
			if (language === 'none') {
				// the language might be 'none' because there is no language set;
				// in this case, we want to use the extension as the language
				var extension = (/\.(\w+)$/.exec(src) || [, 'none'])[1];
				language = EXTENSIONS[extension] || extension;
			}

			// set language classes
			setLanguageClass(code, language);
			setLanguageClass(pre, language);

			// preload the language
			var autoloader = Prism.plugins.autoloader;
			if (autoloader) {
				autoloader.loadLanguages(language);
			}

			// load file
			var xhr = new XMLHttpRequest();
			xhr.open('GET', src, true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {
					if (xhr.status < 400 && xhr.responseText) {
						// mark as loaded
						pre.setAttribute(STATUS_ATTR, STATUS_LOADED);

						// highlight code
						code.textContent = xhr.responseText;
						Prism.highlightElement(code);

					} else {
						// mark as failed
						pre.setAttribute(STATUS_ATTR, STATUS_FAILED);

						if (xhr.status >= 400) {
							code.textContent = FAILURE_MESSAGE(xhr.status, xhr.statusText);
						} else {
							code.textContent = FAILURE_EMPTY_MESSAGE;
						}
					}
				}
			};
			xhr.send(null);
		}
	});

	Prism.plugins.fileHighlight = {
		/**
		 * Executes the File Highlight plugin for all matching `pre` elements under the given container.
		 *
		 * Note: Elements which are already loaded or currently loading will not be touched by this method.
		 *
		 * @param {ParentNode} [container=document]
		 */
		highlight: function highlight(container) {
			var elements = (container || document).querySelectorAll(SELECTOR);

			for (var i = 0, element; element = elements[i++];) {
				Prism.highlightElement(element);
			}
		}
	};

	var logged = false;
	/** @deprecated Use `Prism.plugins.fileHighlight.highlight` instead. */
	Prism.fileHighlight = function () {
		if (!logged) {
			console.warn('Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.');
			logged = true;
		}
		Prism.plugins.fileHighlight.highlight.apply(this, arguments);
	};

})();
}(prism));

var Prism$1 = prism.exports;

(function(Prism) {
	// $ set | grep '^[A-Z][^[:space:]]*=' | cut -d= -f1 | tr '\n' '|'
	// + LC_ALL, RANDOM, REPLY, SECONDS.
	// + make sure PS1..4 are here as they are not always set,
	// - some useless things.
	var envVars = '\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b';

	var commandAfterHeredoc = {
		pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
		lookbehind: true,
		alias: 'punctuation', // this looks reasonably well in all themes
		inside: null // see below
	};

	var insideString = {
		'bash': commandAfterHeredoc,
		'environment': {
			pattern: RegExp("\\$" + envVars),
			alias: 'constant'
		},
		'variable': [
			// [0]: Arithmetic Environment
			{
				pattern: /\$?\(\([\s\S]+?\)\)/,
				greedy: true,
				inside: {
					// If there is a $ sign at the beginning highlight $(( and )) as variable
					'variable': [
						{
							pattern: /(^\$\(\([\s\S]+)\)\)/,
							lookbehind: true
						},
						/^\$\(\(/
					],
					'number': /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
					// Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
					'operator': /--?|-=|\+\+?|\+=|!=?|~|\*\*?|\*=|\/=?|%=?|<<=?|>>=?|<=?|>=?|==?|&&?|&=|\^=?|\|\|?|\|=|\?|:/,
					// If there is no $ sign at the beginning highlight (( and )) as punctuation
					'punctuation': /\(\(?|\)\)?|,|;/
				}
			},
			// [1]: Command Substitution
			{
				pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
				greedy: true,
				inside: {
					'variable': /^\$\(|^`|\)$|`$/
				}
			},
			// [2]: Brace expansion
			{
				pattern: /\$\{[^}]+\}/,
				greedy: true,
				inside: {
					'operator': /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
					'punctuation': /[\[\]]/,
					'environment': {
						pattern: RegExp("(\\{)" + envVars),
						lookbehind: true,
						alias: 'constant'
					}
				}
			},
			/\$(?:\w+|[#?*!@$])/
		],
		// Escape sequences from echo and printf's manuals, and escaped quotes.
		'entity': /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/
	};

	Prism.languages.bash = {
		'shebang': {
			pattern: /^#!\s*\/.*/,
			alias: 'important'
		},
		'comment': {
			pattern: /(^|[^"{\\$])#.*/,
			lookbehind: true
		},
		'function-name': [
			// a) function foo {
			// b) foo() {
			// c) function foo() {
			// but not “foo {”
			{
				// a) and c)
				pattern: /(\bfunction\s+)\w+(?=(?:\s*\(?:\s*\))?\s*\{)/,
				lookbehind: true,
				alias: 'function'
			},
			{
				// b)
				pattern: /\b\w+(?=\s*\(\s*\)\s*\{)/,
				alias: 'function'
			}
		],
		// Highlight variable names as variables in for and select beginnings.
		'for-or-select': {
			pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
			alias: 'variable',
			lookbehind: true
		},
		// Highlight variable names as variables in the left-hand part
		// of assignments (“=” and “+=”).
		'assign-left': {
			pattern: /(^|[\s;|&]|[<>]\()\w+(?=\+?=)/,
			inside: {
				'environment': {
					pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + envVars),
					lookbehind: true,
					alias: 'constant'
				}
			},
			alias: 'variable',
			lookbehind: true
		},
		'string': [
			// Support for Here-documents https://en.wikipedia.org/wiki/Here_document
			{
				pattern: /((?:^|[^<])<<-?\s*)(\w+?)\s[\s\S]*?(?:\r?\n|\r)\2/,
				lookbehind: true,
				greedy: true,
				inside: insideString
			},
			// Here-document with quotes around the tag
			// → No expansion (so no “inside”).
			{
				pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
				lookbehind: true,
				greedy: true,
				inside: {
					'bash': commandAfterHeredoc
				}
			},
			// “Normal” string
			{
				pattern: /(^|[^\\](?:\\\\)*)(["'])(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|(?!\2)[^\\`$])*\2/,
				lookbehind: true,
				greedy: true,
				inside: insideString
			}
		],
		'environment': {
			pattern: RegExp("\\$?" + envVars),
			alias: 'constant'
		},
		'variable': insideString.variable,
		'function': {
			pattern: /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|aptitude|apt-cache|apt-get|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
			lookbehind: true
		},
		'keyword': {
			pattern: /(^|[\s;|&]|[<>]\()(?:if|then|else|elif|fi|for|while|in|case|esac|function|select|do|done|until)(?=$|[)\s;|&])/,
			lookbehind: true
		},
		// https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
		'builtin': {
			pattern: /(^|[\s;|&]|[<>]\()(?:\.|:|break|cd|continue|eval|exec|exit|export|getopts|hash|pwd|readonly|return|shift|test|times|trap|umask|unset|alias|bind|builtin|caller|command|declare|echo|enable|help|let|local|logout|mapfile|printf|read|readarray|source|type|typeset|ulimit|unalias|set|shopt)(?=$|[)\s;|&])/,
			lookbehind: true,
			// Alias added to make those easier to distinguish from strings.
			alias: 'class-name'
		},
		'boolean': {
			pattern: /(^|[\s;|&]|[<>]\()(?:true|false)(?=$|[)\s;|&])/,
			lookbehind: true
		},
		'file-descriptor': {
			pattern: /\B&\d\b/,
			alias: 'important'
		},
		'operator': {
			// Lots of redirections here, but not just that.
			pattern: /\d?<>|>\||\+=|==?|!=?|=~|<<[<-]?|[&\d]?>>|\d?[<>]&?|&[>&]?|\|[&|]?|<=?|>=?/,
			inside: {
				'file-descriptor': {
					pattern: /^\d/,
					alias: 'important'
				}
			}
		},
		'punctuation': /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
		'number': {
			pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
			lookbehind: true
		}
	};

	commandAfterHeredoc.inside = Prism.languages.bash;

	/* Patterns in command substitution. */
	var toBeCopied = [
		'comment',
		'function-name',
		'for-or-select',
		'assign-left',
		'string',
		'environment',
		'function',
		'keyword',
		'builtin',
		'boolean',
		'file-descriptor',
		'operator',
		'punctuation',
		'number'
	];
	var inside = insideString.variable[1].inside;
	for(var i = 0; i < toBeCopied.length; i++) {
		inside[toBeCopied[i]] = Prism.languages.bash[toBeCopied[i]];
	}

	Prism.languages.shell = Prism.languages.bash;
})(Prism);

(function (Prism) {

	var key = /(?:[\w-]+|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*")/.source;

	/**
	 * @param {string} pattern
	 */
	function insertKey(pattern) {
		return pattern.replace(/__/g, function () { return key; });
	}

	Prism.languages.toml = {
		'comment': {
			pattern: /#.*/,
			greedy: true
		},
		'table': {
			pattern: RegExp(insertKey(/(^\s*\[\s*(?:\[\s*)?)__(?:\s*\.\s*__)*(?=\s*\])/.source), 'm'),
			lookbehind: true,
			greedy: true,
			alias: 'class-name'
		},
		'key': {
			pattern: RegExp(insertKey(/(^\s*|[{,]\s*)__(?:\s*\.\s*__)*(?=\s*=)/.source), 'm'),
			lookbehind: true,
			greedy: true,
			alias: 'property'
		},
		'string': {
			pattern: /"""(?:\\[\s\S]|[^\\])*?"""|'''[\s\S]*?'''|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*"/,
			greedy: true
		},
		'date': [
			{
				// Offset Date-Time, Local Date-Time, Local Date
				pattern: /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?\b/i,
				alias: 'number'
			},
			{
				// Local Time
				pattern: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
				alias: 'number'
			}
		],
		'number': /(?:\b0(?:x[\da-zA-Z]+(?:_[\da-zA-Z]+)*|o[0-7]+(?:_[0-7]+)*|b[10]+(?:_[10]+)*))\b|[-+]?\b\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?\b|[-+]?\b(?:inf|nan)\b/,
		'boolean': /\b(?:true|false)\b/,
		'punctuation': /[.,=[\]{}]/
	};
}(Prism));

(function () {

	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	/**
	 * @param {string} selector
	 * @param {ParentNode} [container]
	 * @returns {HTMLElement[]}
	 */
	function $$(selector, container) {
		return Array.prototype.slice.call((container || document).querySelectorAll(selector));
	}

	/**
	 * Returns whether the given element has the given class.
	 *
	 * @param {Element} element
	 * @param {string} className
	 * @returns {boolean}
	 */
	function hasClass(element, className) {
		className = " " + className + " ";
		return (" " + element.className + " ").replace(/[\n\t]/g, " ").indexOf(className) > -1
	}

	/**
	 * Calls the given function.
	 *
	 * @param {() => any} func
	 * @returns {void}
	 */
	function callFunction(func) {
		func();
	}

	// Some browsers round the line-height, others don't.
	// We need to test for it to position the elements properly.
	var isLineHeightRounded = (function () {
		var res;
		return function () {
			if (typeof res === 'undefined') {
				var d = document.createElement('div');
				d.style.fontSize = '13px';
				d.style.lineHeight = '1.5';
				d.style.padding = '0';
				d.style.border = '0';
				d.innerHTML = '&nbsp;<br />&nbsp;';
				document.body.appendChild(d);
				// Browsers that round the line-height should have offsetHeight === 38
				// The others should have 39.
				res = d.offsetHeight === 38;
				document.body.removeChild(d);
			}
			return res;
		}
	}());

	/**
	 * Returns the top offset of the content box of the given parent and the content box of one of its children.
	 *
	 * @param {HTMLElement} parent
	 * @param {HTMLElement} child
	 */
	function getContentBoxTopOffset(parent, child) {
		var parentStyle = getComputedStyle(parent);
		var childStyle = getComputedStyle(child);

		/**
		 * Returns the numeric value of the given pixel value.
		 *
		 * @param {string} px
		 */
		function pxToNumber(px) {
			return +px.substr(0, px.length - 2);
		}

		return child.offsetTop
			+ pxToNumber(childStyle.borderTopWidth)
			+ pxToNumber(childStyle.paddingTop)
			- pxToNumber(parentStyle.paddingTop);
	}

	/**
	 * Highlights the lines of the given pre.
	 *
	 * This function is split into a DOM measuring and mutate phase to improve performance.
	 * The returned function mutates the DOM when called.
	 *
	 * @param {HTMLElement} pre
	 * @param {string | null} [lines]
	 * @param {string} [classes='']
	 * @returns {() => void}
	 */
	function highlightLines(pre, lines, classes) {
		lines = typeof lines === 'string' ? lines : pre.getAttribute('data-line');

		var ranges = lines.replace(/\s+/g, '').split(',').filter(Boolean);
		var offset = +pre.getAttribute('data-line-offset') || 0;

		var parseMethod = isLineHeightRounded() ? parseInt : parseFloat;
		var lineHeight = parseMethod(getComputedStyle(pre).lineHeight);
		var hasLineNumbers = hasClass(pre, 'line-numbers');
		var codeElement = pre.querySelector('code');
		var parentElement = hasLineNumbers ? pre : codeElement || pre;
		var mutateActions = /** @type {(() => void)[]} */ ([]);

		/**
		 * The top offset between the content box of the <code> element and the content box of the parent element of
		 * the line highlight element (either `<pre>` or `<code>`).
		 *
		 * This offset might not be zero for some themes where the <code> element has a top margin. Some plugins
		 * (or users) might also add element above the <code> element. Because the line highlight is aligned relative
		 * to the <pre> element, we have to take this into account.
		 *
		 * This offset will be 0 if the parent element of the line highlight element is the `<code>` element.
		 */
		var codePreOffset = !codeElement || parentElement == codeElement ? 0 : getContentBoxTopOffset(pre, codeElement);

		ranges.forEach(function (currentRange) {
			var range = currentRange.split('-');

			var start = +range[0];
			var end = +range[1] || start;

			/** @type {HTMLElement} */
			var line = pre.querySelector('.line-highlight[data-range="' + currentRange + '"]') || document.createElement('div');

			mutateActions.push(function () {
				line.setAttribute('aria-hidden', 'true');
				line.setAttribute('data-range', currentRange);
				line.className = (classes || '') + ' line-highlight';
			});

			// if the line-numbers plugin is enabled, then there is no reason for this plugin to display the line numbers
			if (hasLineNumbers && Prism.plugins.lineNumbers) {
				var startNode = Prism.plugins.lineNumbers.getLine(pre, start);
				var endNode = Prism.plugins.lineNumbers.getLine(pre, end);

				if (startNode) {
					var top = startNode.offsetTop + codePreOffset + 'px';
					mutateActions.push(function () {
						line.style.top = top;
					});
				}

				if (endNode) {
					var height = (endNode.offsetTop - startNode.offsetTop) + endNode.offsetHeight + 'px';
					mutateActions.push(function () {
						line.style.height = height;
					});
				}
			} else {
				mutateActions.push(function () {
					line.setAttribute('data-start', String(start));

					if (end > start) {
						line.setAttribute('data-end', String(end));
					}

					line.style.top = (start - offset - 1) * lineHeight + codePreOffset + 'px';

					line.textContent = new Array(end - start + 2).join(' \n');
				});
			}

			mutateActions.push(function () {
				// allow this to play nicely with the line-numbers plugin
				// need to attack to pre as when line-numbers is enabled, the code tag is relatively which screws up the positioning
				parentElement.appendChild(line);
			});
		});

		var id = pre.id;
		if (hasLineNumbers && id) {
			// This implements linkable line numbers. Linkable line numbers use Line Highlight to create a link to a
			// specific line. For this to work, the pre element has to:
			//  1) have line numbers,
			//  2) have the `linkable-line-numbers` class or an ascendant that has that class, and
			//  3) have an id.

			var linkableLineNumbersClass = 'linkable-line-numbers';
			var linkableLineNumbers = false;
			var node = pre;
			while (node) {
				if (hasClass(node, linkableLineNumbersClass)) {
					linkableLineNumbers = true;
					break;
				}
				node = node.parentElement;
			}

			if (linkableLineNumbers) {
				if (!hasClass(pre, linkableLineNumbersClass)) {
					// add class to pre
					mutateActions.push(function () {
						pre.className = (pre.className + ' ' + linkableLineNumbersClass).trim();
					});
				}

				var start = parseInt(pre.getAttribute('data-start') || '1');

				// iterate all line number spans
				$$('.line-numbers-rows > span', pre).forEach(function (lineSpan, i) {
					var lineNumber = i + start;
					lineSpan.onclick = function () {
						var hash = id + '.' + lineNumber;

						// this will prevent scrolling since the span is obviously in view
						scrollIntoView = false;
						location.hash = hash;
						setTimeout(function () {
							scrollIntoView = true;
						}, 1);
					};
				});
			}
		}

		return function () {
			mutateActions.forEach(callFunction);
		};
	}

	var scrollIntoView = true;
	function applyHash() {
		var hash = location.hash.slice(1);

		// Remove pre-existing temporary lines
		$$('.temporary.line-highlight').forEach(function (line) {
			line.parentNode.removeChild(line);
		});

		var range = (hash.match(/\.([\d,-]+)$/) || [, ''])[1];

		if (!range || document.getElementById(hash)) {
			return;
		}

		var id = hash.slice(0, hash.lastIndexOf('.')),
			pre = document.getElementById(id);

		if (!pre) {
			return;
		}

		if (!pre.hasAttribute('data-line')) {
			pre.setAttribute('data-line', '');
		}

		var mutateDom = highlightLines(pre, range, 'temporary ');
		mutateDom();

		if (scrollIntoView) {
			document.querySelector('.temporary.line-highlight').scrollIntoView();
		}
	}

	var fakeTimer = 0; // Hack to limit the number of times applyHash() runs

	Prism.hooks.add('before-sanity-check', function (env) {
		var pre = env.element.parentElement;
		var lines = pre && pre.getAttribute('data-line');

		if (!pre || !lines || !/pre/i.test(pre.nodeName)) {
			return;
		}

		/*
		 * Cleanup for other plugins (e.g. autoloader).
		 *
		 * Sometimes <code> blocks are highlighted multiple times. It is necessary
		 * to cleanup any left-over tags, because the whitespace inside of the <div>
		 * tags change the content of the <code> tag.
		 */
		var num = 0;
		$$('.line-highlight', pre).forEach(function (line) {
			num += line.textContent.length;
			line.parentNode.removeChild(line);
		});
		// Remove extra whitespace
		if (num && /^( \n)+$/.test(env.code.slice(-num))) {
			env.code = env.code.slice(0, -num);
		}
	});

	Prism.hooks.add('complete', function completeHook(env) {
		var pre = env.element.parentElement;
		var lines = pre && pre.getAttribute('data-line');

		if (!pre || !lines || !/pre/i.test(pre.nodeName)) {
			return;
		}

		clearTimeout(fakeTimer);

		var hasLineNumbers = Prism.plugins.lineNumbers;
		var isLineNumbersLoaded = env.plugins && env.plugins.lineNumbers;

		if (hasClass(pre, 'line-numbers') && hasLineNumbers && !isLineNumbersLoaded) {
			Prism.hooks.add('line-numbers', completeHook);
		} else {
			var mutateDom = highlightLines(pre, lines);
			mutateDom();
			fakeTimer = setTimeout(applyHash, 1);
		}
	});

	window.addEventListener('hashchange', applyHash);
	window.addEventListener('resize', function () {
		var actions = $$('pre[data-line]').map(function (pre) {
			return highlightLines(pre);
		});
		actions.forEach(callFunction);
	});

})();

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document) {
		return;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
	if (!Element.prototype.matches) {
		Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
	}

	var Prism = window.Prism;

	var LOADING_MESSAGE = 'Loading…';
	var FAILURE_MESSAGE = function (status, message) {
		return '✖ Error ' + status + ' while fetching file: ' + message;
	};
	var FAILURE_EMPTY_MESSAGE = '✖ Error: File does not exist or is empty';

	var EXTENSIONS = {
		'js': 'javascript',
		'py': 'python',
		'rb': 'ruby',
		'ps1': 'powershell',
		'psm1': 'powershell',
		'sh': 'bash',
		'bat': 'batch',
		'h': 'c',
		'tex': 'latex'
	};

	var STATUS_ATTR = 'data-src-status';
	var STATUS_LOADING = 'loading';
	var STATUS_LOADED = 'loaded';
	var STATUS_FAILED = 'failed';

	var SELECTOR = 'pre[data-src]:not([' + STATUS_ATTR + '="' + STATUS_LOADED + '"])'
		+ ':not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';

	var lang = /\blang(?:uage)?-([\w-]+)\b/i;

	/**
	 * Sets the Prism `language-xxxx` or `lang-xxxx` class to the given language.
	 *
	 * @param {HTMLElement} element
	 * @param {string} language
	 * @returns {void}
	 */
	function setLanguageClass(element, language) {
		var className = element.className;
		className = className.replace(lang, ' ') + ' language-' + language;
		element.className = className.replace(/\s+/g, ' ').trim();
	}


	Prism.hooks.add('before-highlightall', function (env) {
		env.selector += ', ' + SELECTOR;
	});

	Prism.hooks.add('before-sanity-check', function (env) {
		var pre = /** @type {HTMLPreElement} */ (env.element);
		if (pre.matches(SELECTOR)) {
			env.code = ''; // fast-path the whole thing and go to complete

			pre.setAttribute(STATUS_ATTR, STATUS_LOADING); // mark as loading

			// add code element with loading message
			var code = pre.appendChild(document.createElement('CODE'));
			code.textContent = LOADING_MESSAGE;

			var src = pre.getAttribute('data-src');

			var language = env.language;
			if (language === 'none') {
				// the language might be 'none' because there is no language set;
				// in this case, we want to use the extension as the language
				var extension = (/\.(\w+)$/.exec(src) || [, 'none'])[1];
				language = EXTENSIONS[extension] || extension;
			}

			// set language classes
			setLanguageClass(code, language);
			setLanguageClass(pre, language);

			// preload the language
			var autoloader = Prism.plugins.autoloader;
			if (autoloader) {
				autoloader.loadLanguages(language);
			}

			// load file
			var xhr = new XMLHttpRequest();
			xhr.open('GET', src, true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {
					if (xhr.status < 400 && xhr.responseText) {
						// mark as loaded
						pre.setAttribute(STATUS_ATTR, STATUS_LOADED);

						// highlight code
						code.textContent = xhr.responseText;
						Prism.highlightElement(code);

					} else {
						// mark as failed
						pre.setAttribute(STATUS_ATTR, STATUS_FAILED);

						if (xhr.status >= 400) {
							code.textContent = FAILURE_MESSAGE(xhr.status, xhr.statusText);
						} else {
							code.textContent = FAILURE_EMPTY_MESSAGE;
						}
					}
				}
			};
			xhr.send(null);
		}
	});

	Prism.plugins.fileHighlight = {
		/**
		 * Executes the File Highlight plugin for all matching `pre` elements under the given container.
		 *
		 * Note: Elements which are already loaded or currently loading will not be touched by this method.
		 *
		 * @param {ParentNode} [container=document]
		 */
		highlight: function highlight(container) {
			var elements = (container || document).querySelectorAll(SELECTOR);

			for (var i = 0, element; element = elements[i++];) {
				Prism.highlightElement(element);
			}
		}
	};

	var logged = false;
	/** @deprecated Use `Prism.plugins.fileHighlight.highlight` instead. */
	Prism.fileHighlight = function () {
		if (!logged) {
			console.warn('Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.');
			logged = true;
		}
		Prism.plugins.fileHighlight.highlight.apply(this, arguments);
	};

})();

/* src/components/Prism.svelte generated by Svelte v3.38.2 */
const file$h = "src/components/Prism.svelte";

function create_fragment$i(ctx) {
	let pre;
	let code_1;
	let t;

	const block = {
		c: function create() {
			pre = element("pre");
			code_1 = element("code");
			t = text(/*code*/ ctx[0]);
			attr_dev(code_1, "class", "" + (null_to_empty(/*langClass*/ ctx[1]) + " svelte-11dfw23"));
			add_location(code_1, file$h, 17, 23, 463);
			attr_dev(pre, "class", /*langClass*/ ctx[1]);
			add_location(pre, file$h, 17, 0, 440);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, pre, anchor);
			append_dev(pre, code_1);
			append_dev(code_1, t);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*code*/ 1) set_data_dev(t, /*code*/ ctx[0]);
		},
		i: noop$1,
		o: noop$1,
		d: function destroy(detaching) {
			if (detaching) detach_dev(pre);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$i.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$i($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Prism", slots, []);
	let { language } = $$props;
	let { code } = $$props;
	const langClass = `language-${language}`;
	onMount(() => Prism$1.highlightAll());
	const writable_props = ["language", "code"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Prism> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("language" in $$props) $$invalidate(2, language = $$props.language);
		if ("code" in $$props) $$invalidate(0, code = $$props.code);
	};

	$$self.$capture_state = () => ({
		onMount,
		Prism: Prism$1,
		language,
		code,
		langClass
	});

	$$self.$inject_state = $$props => {
		if ("language" in $$props) $$invalidate(2, language = $$props.language);
		if ("code" in $$props) $$invalidate(0, code = $$props.code);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [code, langClass, language];
}

class Prism_1 extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$i, create_fragment$i, safe_not_equal, { language: 2, code: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Prism_1",
			options,
			id: create_fragment$i.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*language*/ ctx[2] === undefined && !("language" in props)) {
			console.warn("<Prism> was created without expected prop 'language'");
		}

		if (/*code*/ ctx[0] === undefined && !("code" in props)) {
			console.warn("<Prism> was created without expected prop 'code'");
		}
	}

	get language() {
		throw new Error("<Prism>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set language(value) {
		throw new Error("<Prism>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get code() {
		throw new Error("<Prism>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set code(value) {
		throw new Error("<Prism>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

var fontfaceobserver_standalone = {exports: {}};

/* Font Face Observer v2.1.0 - © Bram Stein. License: BSD-3-Clause */

(function (module) {
(function(){function l(a,b){document.addEventListener?a.addEventListener("scroll",b,!1):a.attachEvent("scroll",b);}function m(a){document.body?a():document.addEventListener?document.addEventListener("DOMContentLoaded",function c(){document.removeEventListener("DOMContentLoaded",c);a();}):document.attachEvent("onreadystatechange",function k(){if("interactive"==document.readyState||"complete"==document.readyState)document.detachEvent("onreadystatechange",k),a();});}function t(a){this.a=document.createElement("div");this.a.setAttribute("aria-hidden","true");this.a.appendChild(document.createTextNode(a));this.b=document.createElement("span");this.c=document.createElement("span");this.h=document.createElement("span");this.f=document.createElement("span");this.g=-1;this.b.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";this.c.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";
this.f.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";this.h.style.cssText="display:inline-block;width:200%;height:200%;font-size:16px;max-width:none;";this.b.appendChild(this.h);this.c.appendChild(this.f);this.a.appendChild(this.b);this.a.appendChild(this.c);}
function u(a,b){a.a.style.cssText="max-width:none;min-width:20px;min-height:20px;display:inline-block;overflow:hidden;position:absolute;width:auto;margin:0;padding:0;top:-999px;white-space:nowrap;font-synthesis:none;font:"+b+";";}function z(a){var b=a.a.offsetWidth,c=b+100;a.f.style.width=c+"px";a.c.scrollLeft=c;a.b.scrollLeft=a.b.scrollWidth+100;return a.g!==b?(a.g=b,!0):!1}function A(a,b){function c(){var a=k;z(a)&&a.a.parentNode&&b(a.g);}var k=a;l(a.b,c);l(a.c,c);z(a);}function B(a,b){var c=b||{};this.family=a;this.style=c.style||"normal";this.weight=c.weight||"normal";this.stretch=c.stretch||"normal";}var C=null,D=null,E=null,F=null;function G(){if(null===D)if(J()&&/Apple/.test(window.navigator.vendor)){var a=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))(?:\.([0-9]+))/.exec(window.navigator.userAgent);D=!!a&&603>parseInt(a[1],10);}else D=!1;return D}function J(){null===F&&(F=!!document.fonts);return F}
function K(){if(null===E){var a=document.createElement("div");try{a.style.font="condensed 100px sans-serif";}catch(b){}E=""!==a.style.font;}return E}function L(a,b){return [a.style,a.weight,K()?a.stretch:"","100px",b].join(" ")}
B.prototype.load=function(a,b){var c=this,k=a||"BESbswy",r=0,n=b||3E3,H=(new Date).getTime();return new Promise(function(a,b){if(J()&&!G()){var M=new Promise(function(a,b){function e(){(new Date).getTime()-H>=n?b(Error(""+n+"ms timeout exceeded")):document.fonts.load(L(c,'"'+c.family+'"'),k).then(function(c){1<=c.length?a():setTimeout(e,25);},b);}e();}),N=new Promise(function(a,c){r=setTimeout(function(){c(Error(""+n+"ms timeout exceeded"));},n);});Promise.race([N,M]).then(function(){clearTimeout(r);a(c);},
b);}else m(function(){function v(){var b;if(b=-1!=f&&-1!=g||-1!=f&&-1!=h||-1!=g&&-1!=h)(b=f!=g&&f!=h&&g!=h)||(null===C&&(b=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))/.exec(window.navigator.userAgent),C=!!b&&(536>parseInt(b[1],10)||536===parseInt(b[1],10)&&11>=parseInt(b[2],10))),b=C&&(f==w&&g==w&&h==w||f==x&&g==x&&h==x||f==y&&g==y&&h==y)),b=!b;b&&(d.parentNode&&d.parentNode.removeChild(d),clearTimeout(r),a(c));}function I(){if((new Date).getTime()-H>=n)d.parentNode&&d.parentNode.removeChild(d),b(Error(""+
n+"ms timeout exceeded"));else {var a=document.hidden;if(!0===a||void 0===a)f=e.a.offsetWidth,g=p.a.offsetWidth,h=q.a.offsetWidth,v();r=setTimeout(I,50);}}var e=new t(k),p=new t(k),q=new t(k),f=-1,g=-1,h=-1,w=-1,x=-1,y=-1,d=document.createElement("div");d.dir="ltr";u(e,L(c,"sans-serif"));u(p,L(c,"serif"));u(q,L(c,"monospace"));d.appendChild(e.a);d.appendChild(p.a);d.appendChild(q.a);document.body.appendChild(d);w=e.a.offsetWidth;x=p.a.offsetWidth;y=q.a.offsetWidth;I();A(e,function(a){f=a;v();});u(e,
L(c,'"'+c.family+'",sans-serif'));A(p,function(a){g=a;v();});u(p,L(c,'"'+c.family+'",serif'));A(q,function(a){h=a;v();});u(q,L(c,'"'+c.family+'",monospace'));});})};module.exports=B;}());
}(fontfaceobserver_standalone));

var FontFaceObserver = fontfaceobserver_standalone.exports;

const loadMonaco = () =>
  new Promise((resolve) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.21.2/min/vs/loader.js";
    script.onload = () => {
      require.config({
        paths: {
          vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.21.2/min/vs",
        },
      });
      require(["vs/editor/editor.main"], () => resolve(monaco));
    };
    document.body.appendChild(script);
  });

const clio$1 = {
  // Set defaultToken to invalid to see what you do not tokenize yet
  // defaultToken: 'invalid',

  keywords: [
    "import",
    "export",
    "from",
    "as",
    "fn",
    "await",
    "[await]",
    "if",
    "else",
    "true",
    "false",
    "and",
    "or",
    "not",
  ],

  typeKeywords: [],

  operators: [
    ">",
    "<",
    ":",
    "=",
    "<=",
    ">=",
    "!=",
    "+",
    "-",
    "*",
    "/",
    "//",
    "|",
    "**",
    "%",
  ],

  // we include these common regular expressions
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  // C# style strings
  escapes:
    /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  // The main tokenizer for our languages
  tokenizer: {
    root: [
      [/fn/, { token: "keyword", next: "@function" }],
      [/->/, { token: "operators", next: "@chain" }],

      // identifiers and keywords
      [
        /[a-zA-Z_$][\w$]*/i,
        {
          cases: {
            "@typeKeywords": "keyword",
            "@keywords": "keyword",
            "@default": "identifier",
          },
        },
      ],

      // whitespace
      { include: "@whitespace" },

      // delimiters and operators
      [/[{}()\[\]]/, "@brackets"],
      [/[<>](?!@symbols)/, "@brackets"],
      [
        /@symbols/,
        {
          cases: {
            "@operators": "operator",
            "@default": "",
          },
        },
      ],

      // @ annotations.
      // As an example, we emit a debugging log message on these tokens.
      // Note: message are supressed during the first load -- change some lines to see them.
      [/@\s*[a-zA-Z_\$][\w\$]*/, { token: "annotation" }],

      // numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/\d+/, "number"],

      // delimiter: after number because of .\d floats
      [/[;,.]/, "delimiter"],

      // strings
      [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
      [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

      // single-quote strings
      [/"([^'\\]|\\.)*$/, "string.invalid"], // non-teminated string
      [/'/, { token: "string.quote", bracket: "@open", next: "@stringSingle" }],
    ],

    comment: [
      [/[^-+]+/, "comment"],
      [/\+-/, "comment", "@push"], // nested comment
      [/-\+/, "comment", "@pop"],
      [/[-+]/, "comment"],
    ],

    string: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
    ],

    stringSingle: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, { token: "string.quote", bracket: "@close", next: "@pop" }],
    ],

    whitespace: [
      [/[ \t\r\n]+/, "white"],
      [/\+-/, "comment", "@comment"],
      [/--.*$/, "comment"],
    ],

    function: [[/[a-zA-Z0-9_]+/, { token: "variable", next: "@pop" }]],

    chain: [
      [/\*/, "operators"],
      [/\[?await\]?/, "keyword"],
      [/[a-zA-Z]+/, { token: "variable", next: "@pop" }],
    ],
  },
};

const pastelsOnDark = {
  base: "vs-dark",
  inherit: true,
  rules: [
    {
      background: "211E1E",
      token: "",
    },
    {
      foreground: "555555",
      token: "comment",
    },
    {
      foreground: "555555",
      token: "comment.block",
    },
    {
      foreground: "ad9361",
      token: "string",
    },
    {
      foreground: "cccccc",
      token: "constant.numeric",
    },
    {
      foreground: "a1a1ff",
      token: "keyword",
    },
    {
      foreground: "2f006e",
      token: "meta.preprocessor",
    },
    {
      fontStyle: "bold",
      token: "keyword.control.import",
    },
    {
      foreground: "a1a1ff",
      token: "support.function",
    },
    {
      foreground: "0000ff",
      token: "declaration.function function-result",
    },
    {
      fontStyle: "bold",
      token: "declaration.function function-name",
    },
    {
      fontStyle: "bold",
      token: "declaration.function argument-name",
    },
    {
      foreground: "0000ff",
      token: "declaration.function function-arg-type",
    },
    {
      fontStyle: "italic",
      token: "declaration.function function-argument",
    },
    {
      fontStyle: "underline",
      token: "declaration.class class-name",
    },
    {
      fontStyle: "italic underline",
      token: "declaration.class class-inheritance",
    },
    {
      foreground: "fff9f9",
      background: "ff0000",
      fontStyle: "bold",
      token: "invalid",
    },
    {
      background: "ffd0d0",
      token: "invalid.deprecated.trailing-whitespace",
    },
    {
      fontStyle: "italic",
      token: "declaration.section section-name",
    },
    {
      foreground: "c10006",
      token: "string.interpolation",
    },
    {
      foreground: "666666",
      token: "string.regexp",
    },
    {
      foreground: "c1c144",
      token: "variable",
    },
    {
      foreground: "6782d3",
      token: "constant",
    },
    {
      foreground: "afa472",
      token: "constant.character",
    },
    {
      foreground: "de8e30",
      fontStyle: "bold",
      token: "constant.language",
    },
    {
      fontStyle: "underline",
      token: "embedded",
    },
    {
      foreground: "858ef4",
      token: "keyword.markup.element-name",
    },
    {
      foreground: "9b456f",
      token: "keyword.markup.attribute-name",
    },
    {
      foreground: "9b456f",
      token: "meta.attribute-with-value",
    },
    {
      foreground: "c82255",
      fontStyle: "bold",
      token: "keyword.exception",
    },
    {
      foreground: "47b8d6",
      token: "keyword.operator",
    },
    {
      foreground: "6969fa",
      fontStyle: "bold",
      token: "keyword.control",
    },
    {
      foreground: "68685b",
      token: "meta.tag.preprocessor.xml",
    },
    {
      foreground: "888888",
      token: "meta.tag.sgml.doctype",
    },
    {
      fontStyle: "italic",
      token: "string.quoted.docinfo.doctype.DTD",
    },
    {
      foreground: "909090",
      token: "comment.other.server-side-include.xhtml",
    },
    {
      foreground: "909090",
      token: "comment.other.server-side-include.html",
    },
    {
      foreground: "858ef4",
      token: "text.html declaration.tag",
    },
    {
      foreground: "858ef4",
      token: "text.html meta.tag",
    },
    {
      foreground: "858ef4",
      token: "text.html entity.name.tag.xhtml",
    },
    {
      foreground: "9b456f",
      token: "keyword.markup.attribute-name",
    },
    {
      foreground: "777777",
      token: "keyword.other.phpdoc.php",
    },
    {
      foreground: "c82255",
      token: "keyword.other.include.php",
    },
    {
      foreground: "de8e20",
      fontStyle: "bold",
      token: "support.constant.core.php",
    },
    {
      foreground: "de8e10",
      fontStyle: "bold",
      token: "support.constant.std.php",
    },
    {
      foreground: "b72e1d",
      token: "variable.other.global.php",
    },
    {
      foreground: "00ff00",
      token: "variable.other.global.safer.php",
    },
    {
      foreground: "bfa36d",
      token: "string.quoted.single.php",
    },
    {
      foreground: "6969fa",
      token: "keyword.storage.php",
    },
    {
      foreground: "ad9361",
      token: "string.quoted.double.php",
    },
    {
      foreground: "ec9e00",
      token: "entity.other.attribute-name.id.css",
    },
    {
      foreground: "b8cd06",
      fontStyle: "bold",
      token: "entity.name.tag.css",
    },
    {
      foreground: "edca06",
      token: "entity.other.attribute-name.class.css",
    },
    {
      foreground: "2e759c",
      token: "entity.other.attribute-name.pseudo-class.css",
    },
    {
      foreground: "ffffff",
      background: "ff0000",
      token: "invalid.bad-comma.css",
    },
    {
      foreground: "9b2e4d",
      token: "support.constant.property-value.css",
    },
    {
      foreground: "e1c96b",
      token: "support.type.property-name.css",
    },
    {
      foreground: "666633",
      token: "constant.other.rgb-value.css",
    },
    {
      foreground: "666633",
      token: "support.constant.font-name.css",
    },
    {
      foreground: "7171f3",
      token: "support.constant.tm-language-def",
    },
    {
      foreground: "7171f3",
      token: "support.constant.name.tm-language-def",
    },
    {
      foreground: "6969fa",
      token: "keyword.other.unit.css",
    },
  ],
  colors: {
    "editor.foreground": "#DADADA",
    "editor.background": "#211E1E",
    "editor.selectionBackground": "#73597E80",
    "editor.lineHighlightBackground": "#353030",
    "editorCursor.foreground": "#FFFFFF",
    "editorWhitespace.foreground": "#4F4D4D",
  },
};

// shim for using process in browser
// based off https://github.com/defunctzombie/node-process/blob/master/browser.js

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
if (typeof global.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
}
if (typeof global.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
}

function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
var title = 'browser';
var platform = 'browser';
var browser$1 = true;
var env = {};
var argv = [];
var version = ''; // empty string to avoid regexp issues
var versions = {};
var release = {};
var config = {};

function noop() {}

var on = noop;
var addListener = noop;
var once = noop;
var off = noop;
var removeListener = noop;
var removeAllListeners = noop;
var emit = noop;

function binding(name) {
    throw new Error('process.binding is not supported');
}

function cwd () { return '/' }
function chdir (dir) {
    throw new Error('process.chdir is not supported');
}function umask() { return 0; }

// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance$1 = global.performance || {};
var performanceNow =
  performance$1.now        ||
  performance$1.mozNow     ||
  performance$1.msNow      ||
  performance$1.oNow       ||
  performance$1.webkitNow  ||
  function(){ return (new Date()).getTime() };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance$1)*1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor((clocktime%1)*1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds<0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds,nanoseconds]
}

var startTime = new Date();
function uptime() {
  var currentTime = new Date();
  var dif = currentTime - startTime;
  return dif / 1000;
}

var browser$1$1 = {
  nextTick: nextTick,
  title: title,
  browser: browser$1,
  env: env,
  argv: argv,
  version: version,
  versions: versions,
  on: on,
  addListener: addListener,
  once: once,
  off: off,
  removeListener: removeListener,
  removeAllListeners: removeAllListeners,
  emit: emit,
  binding: binding,
  cwd: cwd,
  chdir: chdir,
  umask: umask,
  hrtime: hrtime,
  platform: platform,
  release: release,
  config: config,
  uptime: uptime
};

var async_hooks = /*#__PURE__*/Object.freeze({
  __proto__: null
});

var require$$0$3 = /*@__PURE__*/getAugmentedNamespace(async_hooks);

var src = {};

var emitter$1 = {};

const randomId$3 = (n) =>
  [...Array(n)].map((i) => (~~(Math.random() * 36)).toString(36)).join("");

var random = randomId$3;

const { AsyncResource } = require$$0$3;
const randomId$2 = random;

const isRegExp$1 = (o) => Object.prototype.toString.call(o) === "[object RegExp]";

class EventEmitter$g {
  constructor(id) {
    // TODO: this needs to be improved
    this.id = id || "emitter." + randomId$2(64);
    this.resource = AsyncResource ? new AsyncResource(this.id) : null;
    this.listeners = {};
    this.regexListeners = {};
  }
  emit(event, ...args) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].forEach((fn) => fn(...args));
    for (const [pattern, fns] of Object.entries(this.regexListeners)) {
      const regex = eval(pattern);
      if (event.match(regex)) fns.forEach((fn) => fn(event, ...args));
    }
    return this;
  }
  emitUnless(callback, event, ...args) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event]
      .filter((fn) => fn !== callback)
      .forEach((fn) => fn(...args));
    for (const [pattern, fns] of Object.entries(this.regexListeners)) {
      const regex = eval(pattern);
      if (event.match(regex))
        fns.filter((fn) => fn !== callback).forEach((fn) => fn(event, ...args));
    }
    return this;
  }
  on(event, callback) {
    const listeners = isRegExp$1(event) ? this.regexListeners : this.listeners;
    listeners[event] = listeners[event] || [];
    listeners[event].push(callback);
    return this;
  }
  off(event, callback) {
    const listeners = isRegExp$1(event) ? this.regexListeners : this.listeners;
    listeners[event] = listeners[event] || [];
    listeners[event] = listeners[event].filter((fn) => fn !== callback);
    return this;
  }
}

emitter$1.EventEmitter = EventEmitter$g;
emitter$1.emitter = () => new EventEmitter$g();

const parseCloudLocation = (location) => {
  const [_, protocol, host, path] = location.match(
    /([a-z]+):\/\/([^\/]+)\/(.*)/
  );
  return { protocol, host, path };
};

const supported = ["tcp", "ipc", "ws"];

const remote = async (clio, location) => {
  const { protocol, host, path } = parseCloudLocation(location);
  if (!supported.includes(protocol))
    throw new Error(`Protocol "${protocol}" is not supported.`);
  const executor = await clio.distributed.getExecutor(protocol, host);
  const paths = await executor.getFunctions(path);
  const fns = {};
  for (const key in paths) fns[key.slice(path.length + 1)] = paths[key];
  return fns;
};

var remote_1 = remote;

class it {
  constructor(fn, firstIndex = 0, lastIndex = Infinity) {
    this.firstIndex = firstIndex;
    this.lastIndex = lastIndex;
    this.index = 0;
    this.fn = fn;
  }
  next() {
    const value = this.fn(this.firstIndex + this.index++);
    const done = this.lastIndex < this.firstIndex + this.index;
    if (done) this.index = this.firstIndex;
    return { value, done };
  }
  map(fn) {
    const currFn = this.fn;
    this.fn = (index) => fn(currFn(this.firstIndex + index), index, this);
    return this;
  }
  take(n) {
    return new it(this.fn, this.firstIndex, this.firstIndex + n);
  }
  skip(n) {
    return new it(this.fn, this.firstIndex + n, this.lastIndex);
  }
  slice(start, end) {
    return this.skip(this.firstIndex + start).take(end - start);
  }
  toArray() {
    return [...this];
  }
  [Symbol.iterator]() {
    return this;
  }
}

var iterator = it;

var range$1 = {};

class Range$1 {
  constructor(start = 0, end = Infinity, step, mapfn) {
    this.start = start;
    this.end = end;
    this.step = step || (end > start ? 1 : -1);
    this.mapfn = mapfn;
    this.index = 0;
  }
  get length() {
    return Math.floor((this.start - this.end) / this.step);
  }
  map(fn) {
    const mapfn = this.mapfn
      ? (item, index, range) => fn(this.mapfn(item, index, range), index, range)
      : fn;
    return new Range$1(this.start, this.end, this.step, mapfn);
  }
  get(index) {
    const value = this.start + this.step * index;
    if (value > this.end) return undefined; // JS arrays do the same
    return this.mapfn ? this.mapfn(value, index, this) : value;
  }
  take(n) {
    return new Range$1(
      this.start,
      this.start + n * this.step - this.step,
      this.step,
      this.mapfn
    );
  }
  skip(n) {
    return new Range$1(
      this.start + n * this.step,
      this.end,
      this.step,
      this.mapfn
    );
  }
  slice(start, end) {
    return this.skip(start).take(end - start);
  }
  toArray() {
    return [...this];
  }
  toString() {
    return `[${this.start}:${this.end}:${this.step}]`;
  }
  next() {
    const value = this.start + this.step * this.index;
    const done = value >= this.end;
    const mapped = this.mapfn ? this.mapfn(value, this.index, this) : value;
    if (done) this.index = 0;
    else this.index++;
    return { value: mapped, done };
  }
  [Symbol.iterator]() {
    return this;
  }
}

const range = (start, end, step) => new Range$1(start, end, step);

range$1.range = range;
range$1.Range = Range$1;

const { Range } = range$1;

const getIndex = (item, index) => {
  const isRange = item instanceof Range;
  index = index >= 0 ? index : item.length - index;
  return isRange ? item.get(index) : item[index];
};

const numberSlice = (item, number) => getIndex(item, number);

const rangeSlice = (item, range) => {
  const result = [];
  for (const index of range) {
    if (index > item.length) return result;
    result.push(getIndex(item, index));
  }
  return result;
};

const arraySlice = (arr, slicers) => {
  return slicers.map((slicer, index) => {
    if (isNumber$1(slicer)) return getIndex(arr, slicer);
    else return slice(arr[index], slicer);
  });
};

const checkType = (o) =>
  Object.prototype.toString
    .call(o)
    .replace(/\[|object\s|\]/g, "")
    .toLowerCase();

const isNumber$1 = (o) => checkType(o) === "number";
const isRange = (o) => o instanceof Range;

const slice = (arr, slicers) => {
  if (isRange(slicers)) return rangeSlice(arr, slicers);
  if (slicers.length === 1 && isNumber$1(slicers[0]))
    return numberSlice(arr, slicers[0]);
  return arraySlice(arr, slicers);
};

var slice_1 = slice;

var doc = (fn) => console.log(fn.__doc__);

var format = (...args) => args.map((arg) => arg.toString()).join("");

const { EventEmitter: EventEmitter$f, emitter } = emitter$1;

src.remote = remote_1;
src.iterator = iterator;
src.range = range$1.range;
src.randomId = random;
src.slice = slice_1;
src.doc = doc;
src.f = format;
src.EventEmitter = EventEmitter$f;
src.emitter = emitter;

var executor = {};

var common$1 = {};

const { randomId: randomId$1, EventEmitter: EventEmitter$e } = src;

common$1.randomId = randomId$1;
common$1.EventEmitter = EventEmitter$e;

const { randomId, EventEmitter: EventEmitter$d } = common$1;

class Executor$3 {
  constructor(transport) {
    this.transport = transport;
    this.isConnected = false;
    this.connect();
    this.promises = new Map();
    this.emitters = new Map();
    this.id = "executor." + randomId(64);
  }
  connect() {
    this.transport.on("message", (data) => this.handleData(data));
    this.transport.on("connect", () => this.onConnect());
    this.transport.connect();
  }
  onConnect() {
    this.isConnected = true;
  }
  deserialize(data) {
    const reviver = (_, value) => {
      if (value && value["@type"] == "EventEmitter") {
        const { id, clientId } = value;
        if (this.emitters.has(id)) return this.emitters.get(id);
        const emitter = new EventEmitter$d(id);
        const send = (event, ...args) => {
          this.transport.send({
            instruction: "event",
            details: JSON.stringify({ id, event, args }),
            toClient: clientId,
          });
        };
        emitter.on(/.*/, send);
        this.emitters.set(id, { emitter, send });
        return emitter;
      }
      return value;
    };
    return JSON.parse(data, reviver);
  }
  handleData(data) {
    const { id, details, instruction, toClient } = data;
    // TODO: there must be a better way to do this
    if (toClient !== this.id) return;
    const deserialized = this.deserialize(details);
    if (instruction == "result") {
      const { result } = deserialized;
      return this.promises.get(id).resolve(result);
    } else if (instruction == "event") {
      const { id, event, args } = deserialized;
      const { emitter, send } = this.emitters.get(id);
      emitter.emitUnless(send, event, ...args);
    } else if (instruction == "paths") {
      const { paths } = deserialized;
      return this.promises.get(id).resolve(paths);
    }
  }
  call(path, args) {
    const id = randomId(64);
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const send = () =>
      this.transport.send({
        instruction: "call",
        details: JSON.stringify({ path, args }),
        clientId: this.id,
        path,
        id,
      });
    if (this.isConnected) send();
    else this.transport.on("connect", send);
    return promise;
  }
  getFunction(path) {
    return (...args) => this.call(path, args);
  }
  async getFunctions(path) {
    const id = randomId(64);
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const send = () =>
      this.transport.send({
        instruction: "getPaths",
        details: JSON.stringify({ path }),
        clientId: this.id,
        id,
      });
    if (this.isConnected) send();
    else this.transport.on("connect", send);
    const paths = await promise;
    const fns = {};
    for (const path of paths) fns[path] = this.getFunction(path);
    return fns;
  }
}

var Executor_1 = executor.Executor = Executor$3;

var ws$1 = {};

var server$3 = {};

var browser = function () {
  throw new Error(
    'ws does not work in the browser. Browser clients must use the native ' +
      'WebSocket object'
  );
};

var socket$3 = {};

const { EventEmitter: EventEmitter$c } = common$1;

class WSSocket$1 extends EventEmitter$c {
  constructor(socket) {
    super();
    this.socket = socket;
    this.socket.on("message", (data) => this.onData(data));
  }
  send(data) {
    this.socket.send(JSON.stringify(data));
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

socket$3.WSSocket = WSSocket$1;

const WebSocket$1 = browser;
const { WSSocket } = socket$3;
const { EventEmitter: EventEmitter$b } = common$1;

class Server$a extends EventEmitter$b {
  constructor(config) {
    super();
    this.wsConfig = config || Server$a.defaultWSConfig();
    this.ready = false;
  }
  static defaultWSConfig() {
    return { port: 8080, url: "ws://localhost:8080" };
  }
  createWSServer() {
    if (!this.wsConfig) return;
    const { port } = this.wsConfig;
    this.wsServer = new WebSocket$1.Server({ port });
    this.wsServer.on("listening", () => this.onListening());
    this.wsServer.on("connection", (socket) => this.onWSConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onWSConnect(socket) {
    const wsSocket = new WSSocket(socket);
    socket.on("message", (data) => this.handleIncoming(wsSocket, data));
  }
  handleIncoming(socket, data) {
    this.emit("message", socket, data);
  }
  start() {
    return this.createWSServer();
  }
}

server$3.Server = Server$a;

var client$3 = {};

const WebSocket = browser;
const { Server: Server$9 } = server$3;
const { EventEmitter: EventEmitter$a } = common$1;

class Client$7 extends EventEmitter$a {
  constructor(config) {
    super();
    this.wsConfig = config || Server$9.defaultWSConfig();
  }
  connect() {
    const { url } = this.wsConfig;
    this.socket = new WebSocket(url);
    this.socket.on("open", () => this.emit("connect"));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("message", (data) => this.onData(data));
  }
  send(data) {
    this.socket.send(JSON.stringify(data));
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

client$3.Client = Client$7;

const { Server: Server$8 } = server$3;
const { Client: Client$6 } = client$3;

ws$1.Server = Server$8;
ws$1.Client = Client$6;

const { Executor: Executor$2 } = executor;
const WS = ws$1;

var ws = async function (key, protocol, host) {
  const transport = new WS.Client({ url: `${protocol}://${host}` });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor$2(transport);
  this.executors.set(key, executor);
  return executor;
};

var ipc$1 = {};

var server$2 = {};

var _polyfillNode_readline = {};

var _polyfillNode_readline$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  'default': _polyfillNode_readline
});

var require$$0$2 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_readline$1);

var _polyfillNode_net = {};

var _polyfillNode_net$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  'default': _polyfillNode_net
});

var require$$1$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_net$1);

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
function resolve() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : '/';

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
}
// path.normalize(path)
// posix version
function normalize(path) {
  var isPathAbsolute = isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isPathAbsolute).join('/');

  if (!path && !isPathAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isPathAbsolute ? '/' : '') + path;
}
// posix version
function isAbsolute(path) {
  return path.charAt(0) === '/';
}

// posix version
function join$1() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
}


// path.relative(from, to)
// posix version
function relative(from, to) {
  from = resolve(from).substr(1);
  to = resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
}

var sep = '/';
var delimiter = ':';

function dirname(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
}

function basename(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
}


function extname(path) {
  return splitPath(path)[3];
}
var _polyfillNode_path = {
  extname: extname,
  basename: basename,
  dirname: dirname,
  sep: sep,
  delimiter: delimiter,
  relative: relative,
  join: join$1,
  isAbsolute: isAbsolute,
  normalize: normalize,
  resolve: resolve
};
function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b' ?
    function (str, start, len) { return str.substr(start, len) } :
    function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

var _polyfillNode_path$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  resolve: resolve,
  normalize: normalize,
  isAbsolute: isAbsolute,
  join: join$1,
  relative: relative,
  sep: sep,
  delimiter: delimiter,
  dirname: dirname,
  basename: basename,
  extname: extname,
  'default': _polyfillNode_path
});

var require$$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_path$1);

var socket$2 = {};

const readline$5 = require$$0$2;
const { EventEmitter: EventEmitter$9 } = common$1;

class IPCSocket$1 extends EventEmitter$9 {
  constructor(socket) {
    super();
    this.socket = socket;
    this.socket.rl = readline$5.createInterface(this.socket);
    this.socket.rl.on("line", (data) => this.onData(data));
    this.socket.on("close", () => this.socket.rl.close());
  }
  send(data) {
    this.socket.write(JSON.stringify(data) + "\n");
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

socket$2.IPCSocket = IPCSocket$1;

const readline$4 = require$$0$2;
const net$3 = require$$1$1;
const path = require$$1;
const { IPCSocket } = socket$2;
const { EventEmitter: EventEmitter$8 } = common$1;

class Server$7 extends EventEmitter$8 {
  constructor(config) {
    super();
    this.ipcConfig = config || Server$7.defaultIPCConfig();
    this.ready = false;
  }
  static getIPCPath({ name }) {
    const parts = [browser$1$1?.cwd() || ".", name];
    if (browser$1$1?.platform == "win32") parts.unshift("\\\\?\\pipe");
    return path.join(...parts);
  }
  static defaultIPCConfig() {
    return {
      path: Server$7.getIPCPath({ name: "ipc.sock" }),
    };
  }
  createIPCServer() {
    if (!this.ipcConfig) return;
    const { path } = this.ipcConfig;
    this.ipcServer = net$3.createServer();
    this.ipcServer.on("listening", () => this.onListening());
    this.ipcServer.listen(path);
    this.ipcServer.on("connection", (socket) => this.onIPCConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onIPCConnect(socket) {
    socket.rl = readline$4.createInterface(socket);
    socket.rl.on("line", (data) => this.handleIncoming(socket, data));
    socket.on("close", () => socket.rl.close());
  }
  handleIncoming(socket, data) {
    const ipcSocket = new IPCSocket(socket);
    this.emit("message", ipcSocket, data);
  }
  start() {
    return this.createIPCServer();
  }
}

server$2.Server = Server$7;

var client$2 = {};

const readline$3 = require$$0$2;
const net$2 = require$$1$1;
const { Server: Server$6 } = server$2;
const { EventEmitter: EventEmitter$7 } = common$1;

class Client$5 extends EventEmitter$7 {
  constructor(config) {
    super();
    this.ipcConfig = config || Server$6.defaultIPCConfig();
  }
  connect() {
    this.socket = net$2.connect(this.ipcConfig.path);
    this.rl = readline$3.createInterface(this.socket);
    this.rl.on("line", (data) => this.onData(data));
    this.socket.on("connect", () => this.emit("connect"));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("close", () => this.rl.close());
  }
  send(data) {
    this.socket.write(JSON.stringify(data) + "\n");
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

client$2.Client = Client$5;

const { Server: Server$5 } = server$2;
const { Client: Client$4 } = client$2;

ipc$1.Server = Server$5;
ipc$1.Client = Client$4;

const { Executor: Executor$1 } = executor;
const IPC = ipc$1;

var ipc = async function (key, _, path) {
  const transport = new IPC.Client({ path });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor$1(transport);
  this.executors.set(key, executor);
  return executor;
};

var tcp$1 = {};

var server$1 = {};

var socket$1 = {};

const readline$2 = require$$0$2;
const { EventEmitter: EventEmitter$6 } = common$1;

class TCPSocket$1 extends EventEmitter$6 {
  constructor(socket) {
    super();
    this.socket = socket;
    this.socket.rl = readline$2.createInterface(this.socket);
    this.socket.rl.on("line", (data) => this.onData(data));
    this.socket.on("close", () => this.socket.rl.close());
  }
  send(data) {
    this.socket.write(JSON.stringify(data) + "\n");
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

socket$1.TCPSocket = TCPSocket$1;

const readline$1 = require$$0$2;
const net$1 = require$$1$1;
const { TCPSocket } = socket$1;
const { EventEmitter: EventEmitter$5 } = common$1;

class Server$4 extends EventEmitter$5 {
  constructor(config) {
    super();
    this.tcpConfig = config || Server$4.defaultTCPConfig();
    this.ready = false;
  }
  static defaultTCPConfig() {
    return { port: 4444, host: "0.0.0.0" };
  }
  createTCPServer() {
    if (!this.tcpConfig) return;
    const { port, host } = this.tcpConfig;
    this.tcpServer = net$1.createServer();
    this.tcpServer.on("listening", () => this.onListening());
    this.tcpServer.listen(port, host);
    this.tcpServer.on("connection", (socket) => this.onTCPConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onTCPConnect(socket) {
    socket.rl = readline$1.createInterface(socket);
    socket.rl.on("line", (data) => this.handleIncoming(socket, data));
    socket.on("close", () => socket.rl.close());
  }
  handleIncoming(socket, data) {
    const tcpSocket = new TCPSocket(socket);
    this.emit("message", tcpSocket, data);
  }
  start() {
    return this.createTCPServer();
  }
}

server$1.Server = Server$4;

var client$1 = {};

const readline = require$$0$2;
const net = require$$1$1;
const { Server: Server$3 } = server$1;
const { EventEmitter: EventEmitter$4 } = common$1;

class Client$3 extends EventEmitter$4 {
  constructor(config) {
    super();
    this.tcpConfig = config || Server$3.defaultTCPConfig();
  }
  connect() {
    const { port, host } = this.tcpConfig;
    this.socket = net.connect(port, host);
    this.rl = readline.createInterface(this.socket);
    this.rl.on("line", (data) => this.onData(data));
    this.socket.on("connect", () => this.emit("connect"));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("close", () => this.rl.close());
  }
  send(data) {
    this.socket.write(JSON.stringify(data) + "\n");
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

client$1.Client = Client$3;

const { Server: Server$2 } = server$1;
const { Client: Client$2 } = client$1;

tcp$1.Server = Server$2;
tcp$1.Client = Client$2;

const { Executor } = executor;
const TCP = tcp$1;

var tcp = async function (key, _, addr) {
  const [host, port] = addr.split(":");
  const transport = new TCP.Client({ host, port });
  transport.connect();
  await new Promise((resolve) => transport.on("connect", resolve));
  const executor = new Executor(transport);
  this.executors.set(key, executor);
  return executor;
};

const { EventEmitter: EventEmitter$3 } = common$1;

class Dispatcher extends EventEmitter$3 {
  constructor() {
    super();
    this.workers = new Map();
    this.clients = new Map();
    this.jobs = new Map();
    this.rr = new Map();
    this.connectedWorkers = [];
    this.transports = [];
    this.index = 0;
  }
  kill() {
    this.transports.forEach((transport) => {
      if (transport.kill) transport.kill();
    });
  }
  addTransport(transport) {
    this.transports.push(transport);
    transport.on("message", (...args) => this.handleTransportMessage(...args));
    transport.start();
  }
  handleTransportMessage(socket, data) {
    const { instruction, details, id, clientId, ...rest } = JSON.parse(data);
    this.clients.set(clientId, socket);
    const args = [socket, details, id, clientId, rest];
    if (instruction == "call") this.call(...args);
    else if (instruction == "result") this.result(...args);
    else if (instruction == "getPaths") this.getPaths(...args);
    else if (instruction == "registerWorker") this.registerWorker(...args);
    else if (instruction == "event") this.event(...args);
  }
  event(inSocket, details, id, clientId, { toClient }) {
    const socket = this.clients.get(toClient);
    this.send(
      socket,
      { instruction: "event", details, clientId, toClient },
      id
    );
  }
  call(socket, details, id, clientId, { path }) {
    const worker = this.getWorker(path);
    if (worker) {
      const toClient = worker.clientId;
      this.send(
        worker,
        {
          instruction: "call",
          details,
          clientId,
          toClient,
        },
        id
      );
    } else {
      this.addJob(socket, details, id, clientId, { path });
    }
  }
  result(inSocket, details, id, clientId, { toClient }) {
    const socket = this.clients.get(toClient);
    this.send(
      socket,
      { instruction: "result", details, clientId, toClient },
      id
    );
  }
  getPaths(socket, details, id, clientId) {
    const { path } = JSON.parse(details);
    const paths = [...this.workers.keys()].filter((p) => p.startsWith(path));
    this.send(
      socket,
      {
        instruction: "paths",
        details: JSON.stringify({ paths }),
        clientId,
        toClient: clientId,
      },
      id
    );
  }
  registerWorker(worker, details, id, clientId) {
    const { paths } = JSON.parse(details);
    if (!paths.length) return;
    // TODO: there must be a better way to do this
    worker.clientId = clientId;
    for (const path of paths)
      this.workers.set(path, [...(this.workers.get(path) || []), worker]);
    for (const path of paths) {
      const jobs = this.jobs.get(path) || [];
      this.jobs.set(path, []);
      for (const job of jobs) this.call(...job);
    }
    this.connectedWorkers.push(worker);
    const listeners = this.listeners.workerConnected || [];
    listeners.forEach((fn) => fn.call(this, worker));
  }
  addJob(socket, details, id, clientId, path) {
    this.jobs.set(path, [
      ...(this.jobs.get(path) || []),
      [socket, details, id, clientId, path],
    ]);
  }
  schedule(path, length) {
    const stored = this.rr.get(path);
    const curr = Number.isInteger(stored) ? stored : 0;
    const next = curr + 1 >= length ? 0 : curr + 1;
    this.rr.set(path, next);
    return next;
  }
  getWorker(path) {
    const workers = this.workers.get(path);
    if (!workers) return;
    const index = this.schedule(path, workers.length);
    return workers[index];
  }
  send(socket, data, id) {
    socket.send({ ...data, id });
  }
  expectWorkers(n) {
    return new Promise((resolve) => {
      if (this.connectedWorkers.length >= n) resolve();
      const waitForN = () => {
        const { length } = this.connectedWorkers;
        if (length >= n) {
          this.off("workerConnected", waitForN);
          resolve();
        }
      };
      this.on("workerConnected", waitForN);
    });
  }
}

var Dispatcher_1 = Dispatcher;

const builtins = src;

const executors = {
  ws: ws,
  ipc: ipc,
  tcp: tcp,
};

class Distributed {
  constructor(isWorker, connection) {
    this.map = new Map();
    this.isWorker = isWorker;
    this.connection = connection;
    this.executors = new Map();
  }
  set(key, fn) {
    this.map.set(key, fn);
    if (this.isWorker) this.connection.register(key, fn);
  }
  get(key) {
    return this.connection.getFunction(key);
  }
  async getExecutor(protocol, host) {
    const key = `${protocol}:${host}`;
    if (this.executors.has(key)) return this.executors.get(key);
    return await executors[protocol].call(this, key, protocol, host);
  }
}

const workerDist = (executor, worker) =>
  new Distributed(true, {
    register(path, fn) {
      return worker.register({ path, fn });
    },
    getFunction(fn) {
      return executor.getFunction(fn);
    },
    getFunctions(path) {
      return executor.getFunctions(path);
    },
  });

const mainDist = (executor) =>
  new Distributed(false, {
    getFunction(fn) {
      return executor.getFunction(fn);
    },
    getFunctions(path) {
      return executor.getFunctions(path);
    },
  });

const run$1 = async (module, { worker, executor }, { noMain = false } = {}) => {
  const clio = {
    distributed: worker ? workerDist(executor, worker) : mainDist(executor),
    isWorker: !!worker,
    isMain: !worker,
    exports: {},
    ...builtins,
  };
  clio.register = (name, fn) => {
    clio.distributed.set(name, fn);
    fn.parallel = clio.distributed.get(name);
    return fn;
  };
  const { main } = await module.exports(clio);
  const argv = browser$1$1?.argv || [];
  if (!worker && !noMain) {
    const result = await main(argv);
    const awaited = Array.isArray(result)
      ? await Promise.all(result)
      : await result;
    return awaited;
  }
};

var run_1 = run$1;

var webWorker = {};

var server = {};

var socket = {};

const { EventEmitter: EventEmitter$2 } = common$1;

class WebWorkerSocket$1 extends EventEmitter$2 {
  constructor(worker) {
    super();
    this.worker = worker;
    this.messageIds = new Set();
    this.connect();
  }
  connect() {
    this.worker.on("message", (data) =>
      this.handleWorkerMessage(JSON.parse(data))
    );
    this.emit("connect");
  }
  handleWorkerMessage(data) {
    const { id } = data;
    if (this.messageIds.delete(id)) this.emit("message", data);
  }
  send(data) {
    const { id } = data;
    this.messageIds.add(id);
    this.worker.postMessage(JSON.stringify(data));
  }
}

socket.WebWorkerSocket = WebWorkerSocket$1;

const { WebWorkerSocket } = socket;
const { EventEmitter: EventEmitter$1 } = common$1;

class WrappedWebWorker extends EventEmitter$1 {
  constructor(worker) {
    super();
    this.worker = worker;
    this.worker.onmessage = (event) => this.emit("message", event.data);
  }
  postMessage(message) {
    this.worker.postMessage(message);
  }
}

class inSocket {
  constructor(socket) {
    this.socket = socket;
  }
  send(data) {
    this.socket.emit("message", data);
  }
}

class Socket extends EventEmitter$1 {
  constructor(server) {
    super();
    this.server = server;
    this.inSocket = new inSocket(this);
  }
  connect() {
    this.emit("connect");
  }
  send(data) {
    this.server.handleIncoming(this.inSocket, JSON.stringify(data));
  }
}

class Server$1 extends EventEmitter$1 {
  constructor() {
    super();
    this.workers = [];
    this.ready = false;
  }
  start() {
    this.emit("listening");
    this.ready = true;
  }
  addWorker(worker) {
    const wrappedWorker = new WrappedWebWorker(worker);
    const socket = new WebWorkerSocket(wrappedWorker);
    this.workers.push(wrappedWorker);
    wrappedWorker.on("message", (data) => this.handleIncoming(socket, data));
  }
  getTransport() {
    return new Socket(this);
  }
  handleIncoming(socket, data) {
    this.emit("message", socket, data);
  }
}

server.Server = Server$1;

var client = {};

const { EventEmitter } = common$1;

class Client$1 extends EventEmitter {
  constructor({ postMessage }) {
    super();
    this.postMessage = postMessage;
  }
  connect() {
    this.emit("connect");
  }
  onmessage(event) {
    const { data } = event;
    this.emit("message", JSON.parse(data));
  }
  send(data) {
    this.postMessage(JSON.stringify(data));
  }
}

client.Client = Client$1;

const { Server } = server;
const { Client } = client;

webWorker.Server = Server;
webWorker.Client = Client;

const getModule = async (src) => {
  const module = { exports: {} };
  eval(src);
  return module.exports;
};

var run = async (src) => {
  const numCPUs = navigator.hardwareConcurrency;
  const main = await getModule(src);
  const encoded = encodeURIComponent(src.replace(/%/g, "~~mod~~"));

  const dispatcher = new Dispatcher_1();
  const serverTransport = new webWorker.Server();
  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(`./build/worker.js?src=${encoded}`);
    serverTransport.addWorker(worker);
  }
  dispatcher.addTransport(serverTransport);
  return dispatcher.expectWorkers(numCPUs).then(() => {
    const clientTransport = serverTransport.getTransport();
    const executor = new Executor_1(clientTransport);
    return () => run_1(main, { executor }, { noExit: true });
  });
};

var beanParser = {};

class Node {
  constructor(item) {
    this.item = item;
  }
  setNext(node) {
    this.next = node;
    node.prev = this;
  }
  unlink() {
    if (this.next) this.next.prev = this.prev;
    this.prev.next = this.next;
  }
}

class List$1 {
  constructor(array) {
    if (!array.length) return;
    const [first, ...rest] = array;
    this.current = new Node(first);
    this.first = this.current;
    this.last = this.current;
    let curr = this.current;
    for (const item of rest) {
      const node = new Node(item);
      curr.setNext(node);
      curr = node;
    }
    this.last = curr;
  }
  next() {
    this.current = this.current.next;
  }
  prev() {
    this.current = this.current.prev;
  }
  unlinkNext() {
    this.current.next.unlink();
  }
  push(item) {
    const node = new Node(item);
    if (!this.current) {
      this.current = node;
      this.last = this.current;
      this.first = this.current;
      return;
    }
    this.last.setNext(node);
    this.last = node;
  }
}

const beanPriority = (tokens, rules) => {
  while (true) {
    const { current } = tokens;
    const { next } = current;
    if (!next) break;
    const { next: last } = next;
    const rule = rules[current.item.type]?.[next.item.type];
    if (rule) {
      if (last) {
        const nextRule = rules[next.item.type]?.[last.item.type];
        if (nextRule && nextRule.priority > rule.priority) {
          tokens.next();
          continue;
        }
      }
      current.item = rule.value(current.item, next.item);
      tokens.unlinkNext();
      tokens.current = current.prev || current;
      continue;
    }
    tokens.current = next;
  }
  return tokens;
};

const beanNoPriority = (tokens, rules) => {
  while (true) {
    const { current } = tokens;
    const { next } = current;
    if (!next) break;
    const rule = rules[current.item.type]?.[next.item.type];
    if (rule) {
      current.item = rule.value(current.item, next.item);
      tokens.unlinkNext();
      tokens.current = current.prev || current;
      continue;
    }
    tokens.current = next;
  }
  return tokens;
};

const bean$2 = (tokens, rules, priorities = true) => {
  return priorities
    ? beanPriority(tokens, rules)
    : beanNoPriority(tokens, rules);
};

const rule$4 = (value, priority = 1) => ({ value, priority });
const map$q = (keys, rule) => Object.fromEntries(keys.map((key) => [key, rule]));
const mapfn$2 = (keys, fn) => Object.fromEntries(keys.map(fn));
const pod = (type) =>
  rule$4((lhs, rhs) => ({
    type,
    lhs,
    rhs,
  }));

const list$2 = (arr) => new List$1(arr);
const lPluck$4 = (z) => z;
const rPluck = (_, z) => z;
const ignore$c = (...types) => map$q(types, rule$4(lPluck$4));
const name = (type, priority = 1) =>
  rule$4((lhs, rhs) => ({ lhs, rhs, type }), priority);

const merge$4 = (...objects) => {
  const result = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      if (result[key]) result[key] = { ...result[key], ...value };
      else result[key] = value;
    }
  }
  return result;
};

beanParser.rule = rule$4;
beanParser.map = map$q;
beanParser.mapfn = mapfn$2;
beanParser.pod = pod;
beanParser.bean = bean$2;
beanParser.List = List$1;
beanParser.list = list$2;
beanParser.lPluck = lPluck$4;
beanParser.rPluck = rPluck;
beanParser.ignore = ignore$c;
beanParser.name = name;
beanParser.merge = merge$4;

const { list: list$1 } = beanParser;

const strPattern = /^(?:"(?:[^"]|\\")*"|'(?:[^']|\\')*')/;
const numPattern = /^-?(?:[0-9][\d_]*)(?:\.[\d_]+)?(?:[eE][+-]?[\d_]+)?/;

const keywordPattern =
  /^(?:if|else|fn|await|import|as|from|export|and|or|not|by|in)(?=\s|$)|^else(?=:)|^await(?=])/;
const symbolPattern = /^(?:[a-z_$][0-9a-z_$]*)/i; // Should we allow unicode?
const parameterPattern = /^@(?:[a-z_$][0-9a-z_$]*)/i; // Should we allow unicode?
const commentPattern = /^--.*?(?=\n|$)/;
const blockCommentPattern = /^([^+-]|\+[^-]|-[^+])+?(?=(-\+|\+-))/;
const manPattern = /^ *(\n|\n\r|\r\n)(fn |export fn )/;
const awaitAllPattern = /^\[await\]/;

const whites$1 = ["space", "lineBreak", "indent", "outdent", "slicer", "format"];
const wraps = ["lCurly", "lSquare", "lParen"];
const zsIgnore = [...whites$1, "dot", "ranger", ...wraps];

const lex$1 = (source, file, startLine = 1, startColumn = 0) => {
  const tokens = list$1([]);
  const levels = [0];
  let line = startLine; // Mozilla SourceMap library is 1-based, unfortunately
  let column = startColumn;
  let squares = 0;
  let curlies = 0;
  let parens = 0;
  const token = (type, value = "", length = value.length) => {
    tokens.push({ type, value, line, column, file });
    source = source.slice(length);
    column += length;
  };
  // § a single number
  const number = () => {
    const match = source.match(numPattern);
    if (match) token("number", match[0]);
    return !!match;
  };
  // lex a formatted string
  const formattedString = () => {
    const match = source.match(strPattern);
    /* istanbul ignore next */
    if (!match) return false;
    token("fmtStart", '"', 1);
    while (source[0]) {
      // Match an escape, { or *, or end of string
      const point = source.match(/^("|([^\\{"])+|\\.|{)/);
      if (point[0] == '"') {
        token("fmtEnd", '"', 1);
        break;
      } else if (point[0][0] == "\\") {
        token("strEscape", point[0], 2);
      } else if (point[0] == "{") {
        let curls = 0;
        let inner = "";
        while (source[0]) {
          switch (source[0]) {
            case "{":
              curls++;
              break;
            case "}":
              curls--;
              break;
          }
          inner += source[0];
          source = source.slice(1);
          if (curls === 0) break;
        }
        token("fmtExprStart", "", 0);
        const fmtTokens = lex$1(inner.slice(1, -1), file, line, column);
        if (fmtTokens.last?.prev?.prev) {
          fmtTokens.last = fmtTokens.last.prev.prev;
          tokens.last.next = fmtTokens.first;
          fmtTokens.first.prev = tokens.last;
          tokens.last = fmtTokens.last;
        }
        token("ender", "", 0);
        token("fmtExprEnd", "", 0);
      } else {
        token("fmtStr", point[0]);
      }
    }
    return true;
  };
  // match a string
  const string = () => {
    if (tokens.last?.item?.type == "format") return formattedString();
    const match = source.match(strPattern);
    /* istanbul ignore next */
    if (!match) return false;
    token("string", match[0]);
    return true;
  };
  // match a comment
  const comment = () => {
    const match = source.match(commentPattern);
    if (match) {
      source = source.slice(match[0].length);
      const man = source.match(manPattern);
      if (man) token("comment", match[0], 0);
    }
    return !!match;
  };
  const blockComment = () => {
    let comment = source.slice(0, 2);
    source = source.slice(2);
    let open = 1;
    while (true) {
      const match = source.match(blockCommentPattern);
      if (match) {
        comment += match[0];
        source = source.slice(match[0].length);
      } else if (source.slice(0, 2) == "-+") {
        open--;
        comment += "-+";
        source = source.slice(2);
      } else {
        open++;
        comment += "+-";
        source = source.slice(2);
      }
      if (!open) break;
      if (!source) throw "Imbalanced comment blocks"; // FIXME
    }
    const man = source.match(manPattern);
    /* istanbul ignore next */
    if (man) token("comment", comment, 0);
    return true;
  };
  // indent / outdent
  const indents = () => {
    // check if we're in an array or parentheses
    if (squares || curlies || parens) return;
    // check if this isn't an empty line
    const isEmpty = source.match(/^ *(?=[\r\n])/);
    if (isEmpty) return;
    // check if it's a comment line
    const isComment = source.match(/^ *--/);
    if (isComment) return;
    // check if there are spaces
    const match = source.match(/^ */);
    // check if level is changed
    const level = match[0].length;
    const currLevel = levels[0];
    if (level == currLevel) return;
    // check for math or logical
    const shouldSkip = source.match(/^ *([+*\/%=-]|and|or)/);
    const isDedent = level < currLevel;
    if (shouldSkip && !isDedent) {
      /* istanbul ignore next */
      if (tokens.last.prev) tokens.last = tokens.last.prev;
      return;
    }
    if (tokens.last.prev?.item?.type?.endsWith?.("Op")) return;
    // insert outdent / indent token
    if (level < currLevel) {
      if (levels.indexOf(level) == -1)
        throw new Error("Inconsistent indentation");
      while (levels[0] != level) {
        levels.shift();
        token("outdent");
      }
      /* istanbul ignore next */
    } else {
      levels.unshift(level);
      /* istanbul ignore next */
      if (tokens.last.prev) tokens.last = tokens.last.prev;
      token("indent");
    }
  };
  // match an indented hash
  const hashIndent = () => {
    const isIndented = source.match(/^ *(?:[a-z_$][0-9a-z_$]*) *: *\n/);
    if (isIndented) {
      levels.unshift(levels[0] + 2);
      /* istanbul ignore next */
      token("indent");
    }
  };
  // match white spaces
  const space = () => {
    const match = source.match(/ +/);
    /* istanbul ignore next */
    if (!match) return false;
    token("space", match[0]);
    return true;
  };
  // match a keyword
  const keyword = () => {
    const match = source.match(keywordPattern);
    if (match) token(match[0], match[0]);
    return !!match;
  };
  // match await all
  const awaitAll = () => {
    const match = source.match(awaitAllPattern);
    if (match) token("awaitAll", match[0]);
    return !!match;
  };
  // match a symbol
  const symbol = () => {
    const match = source.match(symbolPattern);
    if (match) token("symbol", match[0]);
    return !!match;
  };
  // match a parameter
  const parameter = () => {
    const match = source.match(parameterPattern);
    if (match) token("parameter", match[0]);
    return !!match;
  };
  // match a zero-space
  const zeroSpace = () => {
    const shouldIgnire = zsIgnore.includes(tokens.last?.item?.type);
    if (shouldIgnire) return;
    if (source[0] == '"') token("format", "", 0);
    else if (source[0] == "[") token("slicer", "", 0);
  };
  while (source.length) {
    const char = source[0];
    switch (char) {
      case "#":
        token("hash", char, 1);
        hashIndent();
        break;
      case ".":
        if (source[1] == ".") token("ranger", "..", 2);
        else token("dot", char, 1);
        break;
      case "|":
        token("pike", char, 1);
        break;
      case "{":
        token("groupStart", "", 0);
        token("lCurly", char, 1);
        curlies++;
        break;
      case "}":
        token("rCurly", char, 1);
        token("groupEnd", "", 0);
        curlies--;
        if (curlies < 0) throw new Error("Imbalanced curly braces");
        break;
      case "[":
        if (!awaitAll()) {
          token("groupStart", "", 0);
          token("lSquare", char, 1);
          squares++;
        }
        break;
      case "]":
        token("rSquare", char, 1);
        token("groupEnd", "", 0);
        squares--;
        if (squares < 0) throw new Error("Imbalanced square braces");
        break;
      case "(":
        token("groupStart", "", 0);
        token("lParen", char, 1);
        parens++;
        break;
      case ")":
        token("ender", "", 0);
        token("rParen", char, 1);
        token("groupEnd", "", 0);
        parens--;
        if (parens < 0) throw new Error("Imbalanced parentheses");
        break;
      case ":":
        token("colon", char, 1);
        break;
      case '"':
        string();
        break;
      case "-":
        if (source[1] == ">") {
          token("ender", "", 0);
          token("arrow", "->", 2);
        } else if (!number() && !comment()) {
          token("subOp", char, 1);
        }
        break;
      case "+":
        if (source[1] == "-") {
          blockComment();
        } else {
          token("addOp", char, 1);
        }
        break;
      case ">":
        if (source[1] == "=") token("gte", ">=", 2);
        else token("gt", char, 1);
        break;
      case "<":
        if (source[1] == "=") token("lte", "<=", 2);
        else token("lt", char, 1);
        break;
      case "=":
        if (source[1] == ">") {
          token("ender", "", 0);
          token("fatArrow", "=>", 2);
        } else if (source[1] == "=") token("eq", "==", 2);
        else token("assign", char, 1);
        break;
      case "/":
        token("divOp", char, 1);
        break;
      case "%":
        token("modOp", char, 1);
        break;
      case "*":
        if (source[1] == "*") token("powOp", "**", 2);
        else token("mulOp", "*", 1);
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        number();
        break;
      case " ":
        space();
        break;
      case "\r":
        source = source.slice(1);
        column++;
        break;
      case "\n":
        token("lineBreak", "\n", 1);
        line++;
        column = 0;
        indents();
        break;
      default:
        if (!keyword() && !parameter() && !symbol())
          throw new Error(`Unsupported character ${char}!`);
        break;
    }
    zeroSpace();
  }
  while (levels.shift()) {
    token("lineBreak", "", 0);
    token("outdent", "", 0);
  }
  token("lineBreak", "", 0);
  token("eof", "", 0);
  const { current } = tokens;
  let node = current;
  while (node) {
    /* istanbul ignore next */
    if (node.item.type == "space") {
      node.unlink();
      node = node.prev || node.next;
    } else {
      node = node.next;
    }
  }
  return tokens;
};

var lexer = lex$1;

var types$h = {};

var sourceMap = {};

var sourceMapGenerator = {};

var base64Vlq = {};

var base64$1 = {};

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

const intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");

/**
 * Encode an integer in the range of 0 to 63 to a single base 64 digit.
 */
base64$1.encode = function(number) {
  if (0 <= number && number < intToCharMap.length) {
    return intToCharMap[number];
  }
  throw new TypeError("Must be between 0 and 63: " + number);
};

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const base64 = base64$1;

// A single base 64 digit can contain 6 bits of data. For the base 64 variable
// length quantities we use in the source map spec, the first bit is the sign,
// the next four bits are the actual value, and the 6th bit is the
// continuation bit. The continuation bit tells us whether there are more
// digits in this value following this digit.
//
//   Continuation
//   |    Sign
//   |    |
//   V    V
//   101011

const VLQ_BASE_SHIFT = 5;

// binary: 100000
const VLQ_BASE = 1 << VLQ_BASE_SHIFT;

// binary: 011111
const VLQ_BASE_MASK = VLQ_BASE - 1;

// binary: 100000
const VLQ_CONTINUATION_BIT = VLQ_BASE;

/**
 * Converts from a two-complement value to a value where the sign bit is
 * placed in the least significant bit.  For example, as decimals:
 *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
 *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
 */
function toVLQSigned(aValue) {
  return aValue < 0
    ? ((-aValue) << 1) + 1
    : (aValue << 1) + 0;
}

/**
 * Returns the base 64 VLQ encoded value.
 */
base64Vlq.encode = function base64VLQ_encode(aValue) {
  let encoded = "";
  let digit;

  let vlq = toVLQSigned(aValue);

  do {
    digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) {
      // There are still more digits in this value, so we must make sure the
      // continuation bit is marked.
      digit |= VLQ_CONTINUATION_BIT;
    }
    encoded += base64.encode(digit);
  } while (vlq > 0);

  return encoded;
};

var util$4 = {};

/* -*- Mode: js; js-indent-level: 2; -*- */

(function (exports) {
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This is a helper function for getting values from parameter/options
 * objects.
 *
 * @param args The object we are extracting values from
 * @param name The name of the property we are getting.
 * @param defaultValue An optional value to return if the property is missing
 * from the object. If this is not specified and the property is missing, an
 * error will be thrown.
 */
function getArg(aArgs, aName, aDefaultValue) {
  if (aName in aArgs) {
    return aArgs[aName];
  } else if (arguments.length === 3) {
    return aDefaultValue;
  }
    throw new Error('"' + aName + '" is a required argument.');

}
exports.getArg = getArg;

const urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
const dataUrlRegexp = /^data:.+\,.+$/;

function urlParse(aUrl) {
  const match = aUrl.match(urlRegexp);
  if (!match) {
    return null;
  }
  return {
    scheme: match[1],
    auth: match[2],
    host: match[3],
    port: match[4],
    path: match[5]
  };
}
exports.urlParse = urlParse;

function urlGenerate(aParsedUrl) {
  let url = "";
  if (aParsedUrl.scheme) {
    url += aParsedUrl.scheme + ":";
  }
  url += "//";
  if (aParsedUrl.auth) {
    url += aParsedUrl.auth + "@";
  }
  if (aParsedUrl.host) {
    url += aParsedUrl.host;
  }
  if (aParsedUrl.port) {
    url += ":" + aParsedUrl.port;
  }
  if (aParsedUrl.path) {
    url += aParsedUrl.path;
  }
  return url;
}
exports.urlGenerate = urlGenerate;

const MAX_CACHED_INPUTS = 32;

/**
 * Takes some function `f(input) -> result` and returns a memoized version of
 * `f`.
 *
 * We keep at most `MAX_CACHED_INPUTS` memoized results of `f` alive. The
 * memoization is a dumb-simple, linear least-recently-used cache.
 */
function lruMemoize(f) {
  const cache = [];

  return function(input) {
    for (let i = 0; i < cache.length; i++) {
      if (cache[i].input === input) {
        const temp = cache[0];
        cache[0] = cache[i];
        cache[i] = temp;
        return cache[0].result;
      }
    }

    const result = f(input);

    cache.unshift({
      input,
      result,
    });

    if (cache.length > MAX_CACHED_INPUTS) {
      cache.pop();
    }

    return result;
  };
}

/**
 * Normalizes a path, or the path portion of a URL:
 *
 * - Replaces consecutive slashes with one slash.
 * - Removes unnecessary '.' parts.
 * - Removes unnecessary '<dir>/..' parts.
 *
 * Based on code in the Node.js 'path' core module.
 *
 * @param aPath The path or url to normalize.
 */
const normalize = lruMemoize(function normalize(aPath) {
  let path = aPath;
  const url = urlParse(aPath);
  if (url) {
    if (!url.path) {
      return aPath;
    }
    path = url.path;
  }
  const isAbsolute = exports.isAbsolute(path);

  // Split the path into parts between `/` characters. This is much faster than
  // using `.split(/\/+/g)`.
  const parts = [];
  let start = 0;
  let i = 0;
  while (true) {
    start = i;
    i = path.indexOf("/", start);
    if (i === -1) {
      parts.push(path.slice(start));
      break;
    } else {
      parts.push(path.slice(start, i));
      while (i < path.length && path[i] === "/") {
        i++;
      }
    }
  }

  let up = 0;
  for (i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part === ".") {
      parts.splice(i, 1);
    } else if (part === "..") {
      up++;
    } else if (up > 0) {
      if (part === "") {
        // The first part is blank if the path is absolute. Trying to go
        // above the root is a no-op. Therefore we can remove all '..' parts
        // directly after the root.
        parts.splice(i + 1, up);
        up = 0;
      } else {
        parts.splice(i, 2);
        up--;
      }
    }
  }
  path = parts.join("/");

  if (path === "") {
    path = isAbsolute ? "/" : ".";
  }

  if (url) {
    url.path = path;
    return urlGenerate(url);
  }
  return path;
});
exports.normalize = normalize;

/**
 * Joins two paths/URLs.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be joined with the root.
 *
 * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
 *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
 *   first.
 * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
 *   is updated with the result and aRoot is returned. Otherwise the result
 *   is returned.
 *   - If aPath is absolute, the result is aPath.
 *   - Otherwise the two paths are joined with a slash.
 * - Joining for example 'http://' and 'www.example.com' is also supported.
 */
function join(aRoot, aPath) {
  if (aRoot === "") {
    aRoot = ".";
  }
  if (aPath === "") {
    aPath = ".";
  }
  const aPathUrl = urlParse(aPath);
  const aRootUrl = urlParse(aRoot);
  if (aRootUrl) {
    aRoot = aRootUrl.path || "/";
  }

  // `join(foo, '//www.example.org')`
  if (aPathUrl && !aPathUrl.scheme) {
    if (aRootUrl) {
      aPathUrl.scheme = aRootUrl.scheme;
    }
    return urlGenerate(aPathUrl);
  }

  if (aPathUrl || aPath.match(dataUrlRegexp)) {
    return aPath;
  }

  // `join('http://', 'www.example.com')`
  if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
    aRootUrl.host = aPath;
    return urlGenerate(aRootUrl);
  }

  const joined = aPath.charAt(0) === "/"
    ? aPath
    : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);

  if (aRootUrl) {
    aRootUrl.path = joined;
    return urlGenerate(aRootUrl);
  }
  return joined;
}
exports.join = join;

exports.isAbsolute = function(aPath) {
  return aPath.charAt(0) === "/" || urlRegexp.test(aPath);
};

/**
 * Make a path relative to a URL or another path.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be made relative to aRoot.
 */
function relative(aRoot, aPath) {
  if (aRoot === "") {
    aRoot = ".";
  }

  aRoot = aRoot.replace(/\/$/, "");

  // It is possible for the path to be above the root. In this case, simply
  // checking whether the root is a prefix of the path won't work. Instead, we
  // need to remove components from the root one by one, until either we find
  // a prefix that fits, or we run out of components to remove.
  let level = 0;
  while (aPath.indexOf(aRoot + "/") !== 0) {
    const index = aRoot.lastIndexOf("/");
    if (index < 0) {
      return aPath;
    }

    // If the only part of the root that is left is the scheme (i.e. http://,
    // file:///, etc.), one or more slashes (/), or simply nothing at all, we
    // have exhausted all components, so the path is not relative to the root.
    aRoot = aRoot.slice(0, index);
    if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
      return aPath;
    }

    ++level;
  }

  // Make sure we add a "../" for each component we removed from the root.
  return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
}
exports.relative = relative;

const supportsNullProto = (function() {
  const obj = Object.create(null);
  return !("__proto__" in obj);
}());

function identity(s) {
  return s;
}

/**
 * Because behavior goes wacky when you set `__proto__` on objects, we
 * have to prefix all the strings in our set with an arbitrary character.
 *
 * See https://github.com/mozilla/source-map/pull/31 and
 * https://github.com/mozilla/source-map/issues/30
 *
 * @param String aStr
 */
function toSetString(aStr) {
  if (isProtoString(aStr)) {
    return "$" + aStr;
  }

  return aStr;
}
exports.toSetString = supportsNullProto ? identity : toSetString;

function fromSetString(aStr) {
  if (isProtoString(aStr)) {
    return aStr.slice(1);
  }

  return aStr;
}
exports.fromSetString = supportsNullProto ? identity : fromSetString;

function isProtoString(s) {
  if (!s) {
    return false;
  }

  const length = s.length;

  if (length < 9 /* "__proto__".length */) {
    return false;
  }

  /* eslint-disable no-multi-spaces */
  if (s.charCodeAt(length - 1) !== 95  /* '_' */ ||
      s.charCodeAt(length - 2) !== 95  /* '_' */ ||
      s.charCodeAt(length - 3) !== 111 /* 'o' */ ||
      s.charCodeAt(length - 4) !== 116 /* 't' */ ||
      s.charCodeAt(length - 5) !== 111 /* 'o' */ ||
      s.charCodeAt(length - 6) !== 114 /* 'r' */ ||
      s.charCodeAt(length - 7) !== 112 /* 'p' */ ||
      s.charCodeAt(length - 8) !== 95  /* '_' */ ||
      s.charCodeAt(length - 9) !== 95  /* '_' */) {
    return false;
  }
  /* eslint-enable no-multi-spaces */

  for (let i = length - 10; i >= 0; i--) {
    if (s.charCodeAt(i) !== 36 /* '$' */) {
      return false;
    }
  }

  return true;
}

/**
 * Comparator between two mappings where the original positions are compared.
 *
 * Optionally pass in `true` as `onlyCompareGenerated` to consider two
 * mappings with the same original source/line/column, but different generated
 * line and column the same. Useful when searching for a mapping with a
 * stubbed out mapping.
 */
function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
  let cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0 || onlyCompareOriginal) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByOriginalPositions = compareByOriginalPositions;

/**
 * Comparator between two mappings with deflated source and name indices where
 * the generated positions are compared.
 *
 * Optionally pass in `true` as `onlyCompareGenerated` to consider two
 * mappings with the same generated line and column, but different
 * source/name/original line and column the same. Useful when searching for a
 * mapping with a stubbed out mapping.
 */
function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
  let cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0 || onlyCompareGenerated) {
    return cmp;
  }

  cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

function strcmp(aStr1, aStr2) {
  if (aStr1 === aStr2) {
    return 0;
  }

  if (aStr1 === null) {
    return 1; // aStr2 !== null
  }

  if (aStr2 === null) {
    return -1; // aStr1 !== null
  }

  if (aStr1 > aStr2) {
    return 1;
  }

  return -1;
}

/**
 * Comparator between two mappings with inflated source and name strings where
 * the generated positions are compared.
 */
function compareByGeneratedPositionsInflated(mappingA, mappingB) {
  let cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;

/**
 * Strip any JSON XSSI avoidance prefix from the string (as documented
 * in the source maps specification), and then parse the string as
 * JSON.
 */
function parseSourceMapInput(str) {
  return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
}
exports.parseSourceMapInput = parseSourceMapInput;

/**
 * Compute the URL of a source given the the source root, the source's
 * URL, and the source map's URL.
 */
function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
  sourceURL = sourceURL || "";

  if (sourceRoot) {
    // This follows what Chrome does.
    if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
      sourceRoot += "/";
    }
    // The spec says:
    //   Line 4: An optional source root, useful for relocating source
    //   files on a server or removing repeated values in the
    //   “sources” entry.  This value is prepended to the individual
    //   entries in the “source” field.
    sourceURL = sourceRoot + sourceURL;
  }

  // Historically, SourceMapConsumer did not take the sourceMapURL as
  // a parameter.  This mode is still somewhat supported, which is why
  // this code block is conditional.  However, it's preferable to pass
  // the source map URL to SourceMapConsumer, so that this function
  // can implement the source URL resolution algorithm as outlined in
  // the spec.  This block is basically the equivalent of:
  //    new URL(sourceURL, sourceMapURL).toString()
  // ... except it avoids using URL, which wasn't available in the
  // older releases of node still supported by this library.
  //
  // The spec says:
  //   If the sources are not absolute URLs after prepending of the
  //   “sourceRoot”, the sources are resolved relative to the
  //   SourceMap (like resolving script src in a html document).
  if (sourceMapURL) {
    const parsed = urlParse(sourceMapURL);
    if (!parsed) {
      throw new Error("sourceMapURL could not be parsed");
    }
    if (parsed.path) {
      // Strip the last path component, but keep the "/".
      const index = parsed.path.lastIndexOf("/");
      if (index >= 0) {
        parsed.path = parsed.path.substring(0, index + 1);
      }
    }
    sourceURL = join(urlGenerate(parsed), sourceURL);
  }

  return normalize(sourceURL);
}
exports.computeSourceURL = computeSourceURL;
}(util$4));

var arraySet = {};

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

/**
 * A data structure which is a combination of an array and a set. Adding a new
 * member is O(1), testing for membership is O(1), and finding the index of an
 * element is O(1). Removing elements from the set is not supported. Only
 * strings are supported for membership.
 */
class ArraySet$2 {
  constructor() {
    this._array = [];
    this._set = new Map();
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  static fromArray(aArray, aAllowDuplicates) {
    const set = new ArraySet$2();
    for (let i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  }

  /**
   * Return how many unique items are in this ArraySet. If duplicates have been
   * added, than those do not count towards the size.
   *
   * @returns Number
   */
  size() {
    return this._set.size;
  }

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  add(aStr, aAllowDuplicates) {
    const isDuplicate = this.has(aStr);
    const idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set.set(aStr, idx);
    }
  }

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  has(aStr) {
      return this._set.has(aStr);
  }

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  indexOf(aStr) {
    const idx = this._set.get(aStr);
    if (idx >= 0) {
        return idx;
    }
    throw new Error('"' + aStr + '" is not in the set.');
  }

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error("No element indexed by " + aIdx);
  }

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  toArray() {
    return this._array.slice();
  }
}
arraySet.ArraySet = ArraySet$2;

var mappingList = {};

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2014 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

const util$3 = util$4;

/**
 * Determine whether mappingB is after mappingA with respect to generated
 * position.
 */
function generatedPositionAfter(mappingA, mappingB) {
  // Optimized for most common case
  const lineA = mappingA.generatedLine;
  const lineB = mappingB.generatedLine;
  const columnA = mappingA.generatedColumn;
  const columnB = mappingB.generatedColumn;
  return lineB > lineA || lineB == lineA && columnB >= columnA ||
         util$3.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
}

/**
 * A data structure to provide a sorted view of accumulated mappings in a
 * performance conscious manner. It trades a negligible overhead in general
 * case for a large speedup in case of mappings being added in order.
 */
class MappingList$1 {
  constructor() {
    this._array = [];
    this._sorted = true;
    // Serves as infimum
    this._last = {generatedLine: -1, generatedColumn: 0};
  }

  /**
   * Iterate through internal items. This method takes the same arguments that
   * `Array.prototype.forEach` takes.
   *
   * NOTE: The order of the mappings is NOT guaranteed.
   */
  unsortedForEach(aCallback, aThisArg) {
    this._array.forEach(aCallback, aThisArg);
  }

  /**
   * Add the given source mapping.
   *
   * @param Object aMapping
   */
  add(aMapping) {
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  }

  /**
   * Returns the flat, sorted array of mappings. The mappings are sorted by
   * generated position.
   *
   * WARNING: This method returns internal data without copying, for
   * performance. The return value must NOT be mutated, and should be treated as
   * an immutable borrow. If you want to take ownership, you must make your own
   * copy.
   */
  toArray() {
    if (!this._sorted) {
      this._array.sort(util$3.compareByGeneratedPositionsInflated);
      this._sorted = true;
    }
    return this._array;
  }
}

mappingList.MappingList = MappingList$1;

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

const base64VLQ = base64Vlq;
const util$2 = util$4;
const ArraySet$1 = arraySet.ArraySet;
const MappingList = mappingList.MappingList;

/**
 * An instance of the SourceMapGenerator represents a source map which is
 * being built incrementally. You may pass an object with the following
 * properties:
 *
 *   - file: The filename of the generated source.
 *   - sourceRoot: A root for all relative URLs in this source map.
 */
class SourceMapGenerator$1 {
  constructor(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util$2.getArg(aArgs, "file", null);
    this._sourceRoot = util$2.getArg(aArgs, "sourceRoot", null);
    this._skipValidation = util$2.getArg(aArgs, "skipValidation", false);
    this._sources = new ArraySet$1();
    this._names = new ArraySet$1();
    this._mappings = new MappingList();
    this._sourcesContents = null;
  }

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  static fromSourceMap(aSourceMapConsumer) {
    const sourceRoot = aSourceMapConsumer.sourceRoot;
    const generator = new SourceMapGenerator$1({
      file: aSourceMapConsumer.file,
      sourceRoot
    });
    aSourceMapConsumer.eachMapping(function(mapping) {
      const newMapping = {
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      };

      if (mapping.source != null) {
        newMapping.source = mapping.source;
        if (sourceRoot != null) {
          newMapping.source = util$2.relative(sourceRoot, newMapping.source);
        }

        newMapping.original = {
          line: mapping.originalLine,
          column: mapping.originalColumn
        };

        if (mapping.name != null) {
          newMapping.name = mapping.name;
        }
      }

      generator.addMapping(newMapping);
    });
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      let sourceRelative = sourceFile;
      if (sourceRoot !== null) {
        sourceRelative = util$2.relative(sourceRoot, sourceFile);
      }

      if (!generator._sources.has(sourceRelative)) {
        generator._sources.add(sourceRelative);
      }

      const content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        generator.setSourceContent(sourceFile, content);
      }
    });
    return generator;
  }

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  addMapping(aArgs) {
    const generated = util$2.getArg(aArgs, "generated");
    const original = util$2.getArg(aArgs, "original", null);
    let source = util$2.getArg(aArgs, "source", null);
    let name = util$2.getArg(aArgs, "name", null);

    if (!this._skipValidation) {
      this._validateMapping(generated, original, source, name);
    }

    if (source != null) {
      source = String(source);
      if (!this._sources.has(source)) {
        this._sources.add(source);
      }
    }

    if (name != null) {
      name = String(name);
      if (!this._names.has(name)) {
        this._names.add(name);
      }
    }

    this._mappings.add({
      generatedLine: generated.line,
      generatedColumn: generated.column,
      originalLine: original != null && original.line,
      originalColumn: original != null && original.column,
      source,
      name
    });
  }

  /**
   * Set the source content for a source file.
   */
  setSourceContent(aSourceFile, aSourceContent) {
    let source = aSourceFile;
    if (this._sourceRoot != null) {
      source = util$2.relative(this._sourceRoot, source);
    }

    if (aSourceContent != null) {
      // Add the source content to the _sourcesContents map.
      // Create a new _sourcesContents map if the property is null.
      if (!this._sourcesContents) {
        this._sourcesContents = Object.create(null);
      }
      this._sourcesContents[util$2.toSetString(source)] = aSourceContent;
    } else if (this._sourcesContents) {
      // Remove the source file from the _sourcesContents map.
      // If the _sourcesContents map is empty, set the property to null.
      delete this._sourcesContents[util$2.toSetString(source)];
      if (Object.keys(this._sourcesContents).length === 0) {
        this._sourcesContents = null;
      }
    }
  }

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   * @param aSourceMapPath Optional. The dirname of the path to the source map
   *        to be applied. If relative, it is relative to the SourceMapConsumer.
   *        This parameter is needed when the two source maps aren't in the same
   *        directory, and the source map to be applied contains relative source
   *        paths. If so, those relative source paths need to be rewritten
   *        relative to the SourceMapGenerator.
   */
  applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
    let sourceFile = aSourceFile;
    // If aSourceFile is omitted, we will use the file property of the SourceMap
    if (aSourceFile == null) {
      if (aSourceMapConsumer.file == null) {
        throw new Error(
          "SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, " +
          'or the source map\'s "file" property. Both were omitted.'
        );
      }
      sourceFile = aSourceMapConsumer.file;
    }
    const sourceRoot = this._sourceRoot;
    // Make "sourceFile" relative if an absolute Url is passed.
    if (sourceRoot != null) {
      sourceFile = util$2.relative(sourceRoot, sourceFile);
    }
    // Applying the SourceMap can add and remove items from the sources and
    // the names array.
    const newSources = this._mappings.toArray().length > 0
      ? new ArraySet$1()
      : this._sources;
    const newNames = new ArraySet$1();

    // Find mappings for the "sourceFile"
    this._mappings.unsortedForEach(function(mapping) {
      if (mapping.source === sourceFile && mapping.originalLine != null) {
        // Check if it can be mapped by the source map, then update the mapping.
        const original = aSourceMapConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn
        });
        if (original.source != null) {
          // Copy mapping
          mapping.source = original.source;
          if (aSourceMapPath != null) {
            mapping.source = util$2.join(aSourceMapPath, mapping.source);
          }
          if (sourceRoot != null) {
            mapping.source = util$2.relative(sourceRoot, mapping.source);
          }
          mapping.originalLine = original.line;
          mapping.originalColumn = original.column;
          if (original.name != null) {
            mapping.name = original.name;
          }
        }
      }

      const source = mapping.source;
      if (source != null && !newSources.has(source)) {
        newSources.add(source);
      }

      const name = mapping.name;
      if (name != null && !newNames.has(name)) {
        newNames.add(name);
      }

    }, this);
    this._sources = newSources;
    this._names = newNames;

    // Copy sourcesContents of applied map.
    aSourceMapConsumer.sources.forEach(function(srcFile) {
      const content = aSourceMapConsumer.sourceContentFor(srcFile);
      if (content != null) {
        if (aSourceMapPath != null) {
          srcFile = util$2.join(aSourceMapPath, srcFile);
        }
        if (sourceRoot != null) {
          srcFile = util$2.relative(sourceRoot, srcFile);
        }
        this.setSourceContent(srcFile, content);
      }
    }, this);
  }

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  _validateMapping(aGenerated, aOriginal, aSource, aName) {
    // When aOriginal is truthy but has empty values for .line and .column,
    // it is most likely a programmer error. In this case we throw a very
    // specific error message to try to guide them the right way.
    // For example: https://github.com/Polymer/polymer-bundler/pull/519
    if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
        throw new Error(
            "original.line and original.column are not numbers -- you probably meant to omit " +
            "the original mapping entirely and only map the generated position. If so, pass " +
            "null for the original mapping instead of an object with empty or null values."
        );
    }

    if (aGenerated && "line" in aGenerated && "column" in aGenerated
        && aGenerated.line > 0 && aGenerated.column >= 0
        && !aOriginal && !aSource && !aName) ; else if (aGenerated && "line" in aGenerated && "column" in aGenerated
             && aOriginal && "line" in aOriginal && "column" in aOriginal
             && aGenerated.line > 0 && aGenerated.column >= 0
             && aOriginal.line > 0 && aOriginal.column >= 0
             && aSource) ; else {
      throw new Error("Invalid mapping: " + JSON.stringify({
        generated: aGenerated,
        source: aSource,
        original: aOriginal,
        name: aName
      }));
    }
  }

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  _serializeMappings() {
    let previousGeneratedColumn = 0;
    let previousGeneratedLine = 1;
    let previousOriginalColumn = 0;
    let previousOriginalLine = 0;
    let previousName = 0;
    let previousSource = 0;
    let result = "";
    let next;
    let mapping;
    let nameIdx;
    let sourceIdx;

    const mappings = this._mappings.toArray();
    for (let i = 0, len = mappings.length; i < len; i++) {
      mapping = mappings[i];
      next = "";

      if (mapping.generatedLine !== previousGeneratedLine) {
        previousGeneratedColumn = 0;
        while (mapping.generatedLine !== previousGeneratedLine) {
          next += ";";
          previousGeneratedLine++;
        }
      } else if (i > 0) {
        if (!util$2.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
          continue;
        }
        next += ",";
      }

      next += base64VLQ.encode(mapping.generatedColumn
                                 - previousGeneratedColumn);
      previousGeneratedColumn = mapping.generatedColumn;

      if (mapping.source != null) {
        sourceIdx = this._sources.indexOf(mapping.source);
        next += base64VLQ.encode(sourceIdx - previousSource);
        previousSource = sourceIdx;

        // lines are stored 0-based in SourceMap spec version 3
        next += base64VLQ.encode(mapping.originalLine - 1
                                   - previousOriginalLine);
        previousOriginalLine = mapping.originalLine - 1;

        next += base64VLQ.encode(mapping.originalColumn
                                   - previousOriginalColumn);
        previousOriginalColumn = mapping.originalColumn;

        if (mapping.name != null) {
          nameIdx = this._names.indexOf(mapping.name);
          next += base64VLQ.encode(nameIdx - previousName);
          previousName = nameIdx;
        }
      }

      result += next;
    }

    return result;
  }

  _generateSourcesContent(aSources, aSourceRoot) {
    return aSources.map(function(source) {
      if (!this._sourcesContents) {
        return null;
      }
      if (aSourceRoot != null) {
        source = util$2.relative(aSourceRoot, source);
      }
      const key = util$2.toSetString(source);
      return Object.prototype.hasOwnProperty.call(this._sourcesContents, key)
        ? this._sourcesContents[key]
        : null;
    }, this);
  }

  /**
   * Externalize the source map.
   */
  toJSON() {
    const map = {
      version: this._version,
      sources: this._sources.toArray(),
      names: this._names.toArray(),
      mappings: this._serializeMappings()
    };
    if (this._file != null) {
      map.file = this._file;
    }
    if (this._sourceRoot != null) {
      map.sourceRoot = this._sourceRoot;
    }
    if (this._sourcesContents) {
      map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
    }

    return map;
  }

  /**
   * Render the source map being generated to a string.
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

SourceMapGenerator$1.prototype._version = 3;
sourceMapGenerator.SourceMapGenerator = SourceMapGenerator$1;

var sourceMapConsumer = {};

var binarySearch$1 = {};

/* -*- Mode: js; js-indent-level: 2; -*- */

(function (exports) {
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

exports.GREATEST_LOWER_BOUND = 1;
exports.LEAST_UPPER_BOUND = 2;

/**
 * Recursive implementation of binary search.
 *
 * @param aLow Indices here and lower do not contain the needle.
 * @param aHigh Indices here and higher do not contain the needle.
 * @param aNeedle The element being searched for.
 * @param aHaystack The non-empty array being searched.
 * @param aCompare Function which takes two elements and returns -1, 0, or 1.
 * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
 *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 */
function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
  // This function terminates when one of the following is true:
  //
  //   1. We find the exact element we are looking for.
  //
  //   2. We did not find the exact element, but we can return the index of
  //      the next-closest element.
  //
  //   3. We did not find the exact element, and there is no next-closest
  //      element than the one we are searching for, so we return -1.
  const mid = Math.floor((aHigh - aLow) / 2) + aLow;
  const cmp = aCompare(aNeedle, aHaystack[mid], true);
  if (cmp === 0) {
    // Found the element we are looking for.
    return mid;
  } else if (cmp > 0) {
    // Our needle is greater than aHaystack[mid].
    if (aHigh - mid > 1) {
      // The element is in the upper half.
      return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
    }

    // The exact needle element was not found in this haystack. Determine if
    // we are in termination case (3) or (2) and return the appropriate thing.
    if (aBias == exports.LEAST_UPPER_BOUND) {
      return aHigh < aHaystack.length ? aHigh : -1;
    }
    return mid;
  }

  // Our needle is less than aHaystack[mid].
  if (mid - aLow > 1) {
    // The element is in the lower half.
    return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
  }

  // we are in termination case (3) or (2) and return the appropriate thing.
  if (aBias == exports.LEAST_UPPER_BOUND) {
    return mid;
  }
  return aLow < 0 ? -1 : aLow;
}

/**
 * This is an implementation of binary search which will always try and return
 * the index of the closest element if there is no exact hit. This is because
 * mappings between original and generated line/col pairs are single points,
 * and there is an implicit region between each of them, so a miss just means
 * that you aren't on the very start of a region.
 *
 * @param aNeedle The element you are looking for.
 * @param aHaystack The array that is being searched.
 * @param aCompare A function which takes the needle and an element in the
 *     array and returns -1, 0, or 1 depending on whether the needle is less
 *     than, equal to, or greater than the element, respectively.
 * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
 *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
 */
exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
  if (aHaystack.length === 0) {
    return -1;
  }

  let index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack,
                              aCompare, aBias || exports.GREATEST_LOWER_BOUND);
  if (index < 0) {
    return -1;
  }

  // We have found either the exact element, or the next-closest element than
  // the one we are searching for. However, there may be more than one such
  // element. Make sure we always return the smallest of these.
  while (index - 1 >= 0) {
    if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
      break;
    }
    --index;
  }

  return index;
};
}(binarySearch$1));

var __dirname = '/Users/pouya/Projects/clio/node_modules/source-map/lib';

var readWasm$2 = {exports: {}};

var _polyfillNode_fs = {};

var _polyfillNode_fs$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  'default': _polyfillNode_fs
});

var require$$0$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_fs$1);

if (typeof fetch === "function") {
  // Web version of reading a wasm file into an array buffer.

  let mappingsWasmUrl = null;

  readWasm$2.exports = function readWasm() {
    if (typeof mappingsWasmUrl !== "string") {
      throw new Error("You must provide the URL of lib/mappings.wasm by calling " +
                      "SourceMapConsumer.initialize({ 'lib/mappings.wasm': ... }) " +
                      "before using SourceMapConsumer");
    }

    return fetch(mappingsWasmUrl)
      .then(response => response.arrayBuffer());
  };

  readWasm$2.exports.initialize = url => mappingsWasmUrl = url;
} else {
  // Node version of reading a wasm file into an array buffer.
  const fs = require$$0$1;
  const path = require$$1;

  readWasm$2.exports = function readWasm() {
    return new Promise((resolve, reject) => {
      const wasmPath = path.join(__dirname, "mappings.wasm");
      fs.readFile(wasmPath, null, (error, data) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(data.buffer);
      });
    });
  };

  readWasm$2.exports.initialize = _ => {
    console.debug("SourceMapConsumer.initialize is a no-op when running in node.js");
  };
}

const readWasm$1 = readWasm$2.exports;

/**
 * Provide the JIT with a nice shape / hidden class.
 */
function Mapping() {
  this.generatedLine = 0;
  this.generatedColumn = 0;
  this.lastGeneratedColumn = null;
  this.source = null;
  this.originalLine = null;
  this.originalColumn = null;
  this.name = null;
}

let cachedWasm = null;

var wasm$1 = function wasm() {
  if (cachedWasm) {
    return cachedWasm;
  }

  const callbackStack = [];

  cachedWasm = readWasm$1().then(buffer => {
      return WebAssembly.instantiate(buffer, {
        env: {
          mapping_callback(
            generatedLine,
            generatedColumn,

            hasLastGeneratedColumn,
            lastGeneratedColumn,

            hasOriginal,
            source,
            originalLine,
            originalColumn,

            hasName,
            name
          ) {
            const mapping = new Mapping();
            // JS uses 1-based line numbers, wasm uses 0-based.
            mapping.generatedLine = generatedLine + 1;
            mapping.generatedColumn = generatedColumn;

            if (hasLastGeneratedColumn) {
              // JS uses inclusive last generated column, wasm uses exclusive.
              mapping.lastGeneratedColumn = lastGeneratedColumn - 1;
            }

            if (hasOriginal) {
              mapping.source = source;
              // JS uses 1-based line numbers, wasm uses 0-based.
              mapping.originalLine = originalLine + 1;
              mapping.originalColumn = originalColumn;

              if (hasName) {
                mapping.name = name;
              }
            }

            callbackStack[callbackStack.length - 1](mapping);
          },

          start_all_generated_locations_for() { console.time("all_generated_locations_for"); },
          end_all_generated_locations_for() { console.timeEnd("all_generated_locations_for"); },

          start_compute_column_spans() { console.time("compute_column_spans"); },
          end_compute_column_spans() { console.timeEnd("compute_column_spans"); },

          start_generated_location_for() { console.time("generated_location_for"); },
          end_generated_location_for() { console.timeEnd("generated_location_for"); },

          start_original_location_for() { console.time("original_location_for"); },
          end_original_location_for() { console.timeEnd("original_location_for"); },

          start_parse_mappings() { console.time("parse_mappings"); },
          end_parse_mappings() { console.timeEnd("parse_mappings"); },

          start_sort_by_generated_location() { console.time("sort_by_generated_location"); },
          end_sort_by_generated_location() { console.timeEnd("sort_by_generated_location"); },

          start_sort_by_original_location() { console.time("sort_by_original_location"); },
          end_sort_by_original_location() { console.timeEnd("sort_by_original_location"); },
        }
      });
  }).then(Wasm => {
    return {
      exports: Wasm.instance.exports,
      withMappingCallback: (mappingCallback, f) => {
        callbackStack.push(mappingCallback);
        try {
          f();
        } finally {
          callbackStack.pop();
        }
      }
    };
  }).then(null, e => {
    cachedWasm = null;
    throw e;
  });

  return cachedWasm;
};

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

const util$1 = util$4;
const binarySearch = binarySearch$1;
const ArraySet = arraySet.ArraySet;
const readWasm = readWasm$2.exports;
const wasm = wasm$1;

const INTERNAL = Symbol("smcInternal");

class SourceMapConsumer {
  constructor(aSourceMap, aSourceMapURL) {
    // If the constructor was called by super(), just return Promise<this>.
    // Yes, this is a hack to retain the pre-existing API of the base-class
    // constructor also being an async factory function.
    if (aSourceMap == INTERNAL) {
      return Promise.resolve(this);
    }

    return _factory(aSourceMap, aSourceMapURL);
  }

  static initialize(opts) {
    readWasm.initialize(opts["lib/mappings.wasm"]);
  }

  static fromSourceMap(aSourceMap, aSourceMapURL) {
    return _factoryBSM(aSourceMap, aSourceMapURL);
  }

  /**
   * Construct a new `SourceMapConsumer` from `rawSourceMap` and `sourceMapUrl`
   * (see the `SourceMapConsumer` constructor for details. Then, invoke the `async
   * function f(SourceMapConsumer) -> T` with the newly constructed consumer, wait
   * for `f` to complete, call `destroy` on the consumer, and return `f`'s return
   * value.
   *
   * You must not use the consumer after `f` completes!
   *
   * By using `with`, you do not have to remember to manually call `destroy` on
   * the consumer, since it will be called automatically once `f` completes.
   *
   * ```js
   * const xSquared = await SourceMapConsumer.with(
   *   myRawSourceMap,
   *   null,
   *   async function (consumer) {
   *     // Use `consumer` inside here and don't worry about remembering
   *     // to call `destroy`.
   *
   *     const x = await whatever(consumer);
   *     return x * x;
   *   }
   * );
   *
   * // You may not use that `consumer` anymore out here; it has
   * // been destroyed. But you can use `xSquared`.
   * console.log(xSquared);
   * ```
   */
  static with(rawSourceMap, sourceMapUrl, f) {
    // Note: The `acorn` version that `webpack` currently depends on doesn't
    // support `async` functions, and the nodes that we support don't all have
    // `.finally`. Therefore, this is written a bit more convolutedly than it
    // should really be.

    let consumer = null;
    const promise = new SourceMapConsumer(rawSourceMap, sourceMapUrl);
    return promise
      .then(c => {
        consumer = c;
        return f(c);
      })
      .then(x => {
        if (consumer) {
          consumer.destroy();
        }
        return x;
      }, e => {
        if (consumer) {
          consumer.destroy();
        }
        throw e;
      });
  }

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  _parseMappings(aStr, aSourceRoot) {
    throw new Error("Subclasses must implement _parseMappings");
  }

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  eachMapping(aCallback, aContext, aOrder) {
    throw new Error("Subclasses must implement eachMapping");
  }

  /**
   * Returns all generated line and column information for the original source,
   * line, and column provided. If no column is provided, returns all mappings
   * corresponding to a either the line we are searching for or the next
   * closest line that has any mappings. Otherwise, returns all mappings
   * corresponding to the given line and either the column we are searching for
   * or the next closest column that has any offsets.
   *
   * The only argument is an object with the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.  The line number is 1-based.
   *   - column: Optional. the column number in the original source.
   *    The column number is 0-based.
   *
   * and an array of objects is returned, each with the following properties:
   *
   *   - line: The line number in the generated source, or null.  The
   *    line number is 1-based.
   *   - column: The column number in the generated source, or null.
   *    The column number is 0-based.
   */
  allGeneratedPositionsFor(aArgs) {
    throw new Error("Subclasses must implement allGeneratedPositionsFor");
  }

  destroy() {
    throw new Error("Subclasses must implement destroy");
  }
}

/**
 * The version of the source mapping spec that we are consuming.
 */
SourceMapConsumer.prototype._version = 3;
SourceMapConsumer.GENERATED_ORDER = 1;
SourceMapConsumer.ORIGINAL_ORDER = 2;

SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
SourceMapConsumer.LEAST_UPPER_BOUND = 2;

sourceMapConsumer.SourceMapConsumer = SourceMapConsumer;

/**
 * A BasicSourceMapConsumer instance represents a parsed source map which we can
 * query for information about the original file positions by giving it a file
 * position in the generated source.
 *
 * The first parameter is the raw source map (either as a JSON string, or
 * already parsed to an object). According to the spec, source maps have the
 * following attributes:
 *
 *   - version: Which version of the source map spec this map is following.
 *   - sources: An array of URLs to the original source files.
 *   - names: An array of identifiers which can be referenced by individual mappings.
 *   - sourceRoot: Optional. The URL root from which all sources are relative.
 *   - sourcesContent: Optional. An array of contents of the original source files.
 *   - mappings: A string of base64 VLQs which contain the actual mappings.
 *   - file: Optional. The generated file this source map is associated with.
 *
 * Here is an example source map, taken from the source map spec[0]:
 *
 *     {
 *       version : 3,
 *       file: "out.js",
 *       sourceRoot : "",
 *       sources: ["foo.js", "bar.js"],
 *       names: ["src", "maps", "are", "fun"],
 *       mappings: "AA,AB;;ABCDE;"
 *     }
 *
 * The second parameter, if given, is a string whose value is the URL
 * at which the source map was found.  This URL is used to compute the
 * sources array.
 *
 * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
 */
class BasicSourceMapConsumer extends SourceMapConsumer {
  constructor(aSourceMap, aSourceMapURL) {
    return super(INTERNAL).then(that => {
      let sourceMap = aSourceMap;
      if (typeof aSourceMap === "string") {
        sourceMap = util$1.parseSourceMapInput(aSourceMap);
      }

      const version = util$1.getArg(sourceMap, "version");
      let sources = util$1.getArg(sourceMap, "sources");
      // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
      // requires the array) to play nice here.
      const names = util$1.getArg(sourceMap, "names", []);
      let sourceRoot = util$1.getArg(sourceMap, "sourceRoot", null);
      const sourcesContent = util$1.getArg(sourceMap, "sourcesContent", null);
      const mappings = util$1.getArg(sourceMap, "mappings");
      const file = util$1.getArg(sourceMap, "file", null);

      // Once again, Sass deviates from the spec and supplies the version as a
      // string rather than a number, so we use loose equality checking here.
      if (version != that._version) {
        throw new Error("Unsupported version: " + version);
      }

      if (sourceRoot) {
        sourceRoot = util$1.normalize(sourceRoot);
      }

      sources = sources
        .map(String)
        // Some source maps produce relative source paths like "./foo.js" instead of
        // "foo.js".  Normalize these first so that future comparisons will succeed.
        // See bugzil.la/1090768.
        .map(util$1.normalize)
        // Always ensure that absolute sources are internally stored relative to
        // the source root, if the source root is absolute. Not doing this would
        // be particularly problematic when the source root is a prefix of the
        // source (valid, but why??). See github issue #199 and bugzil.la/1188982.
        .map(function(source) {
          return sourceRoot && util$1.isAbsolute(sourceRoot) && util$1.isAbsolute(source)
            ? util$1.relative(sourceRoot, source)
            : source;
        });

      // Pass `true` below to allow duplicate names and sources. While source maps
      // are intended to be compressed and deduplicated, the TypeScript compiler
      // sometimes generates source maps with duplicates in them. See Github issue
      // #72 and bugzil.la/889492.
      that._names = ArraySet.fromArray(names.map(String), true);
      that._sources = ArraySet.fromArray(sources, true);

      that._absoluteSources = that._sources.toArray().map(function(s) {
        return util$1.computeSourceURL(sourceRoot, s, aSourceMapURL);
      });

      that.sourceRoot = sourceRoot;
      that.sourcesContent = sourcesContent;
      that._mappings = mappings;
      that._sourceMapURL = aSourceMapURL;
      that.file = file;

      that._computedColumnSpans = false;
      that._mappingsPtr = 0;
      that._wasm = null;

      return wasm().then(w => {
        that._wasm = w;
        return that;
      });
    });
  }

  /**
   * Utility function to find the index of a source.  Returns -1 if not
   * found.
   */
  _findSourceIndex(aSource) {
    let relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util$1.relative(this.sourceRoot, relativeSource);
    }

    if (this._sources.has(relativeSource)) {
      return this._sources.indexOf(relativeSource);
    }

    // Maybe aSource is an absolute URL as returned by |sources|.  In
    // this case we can't simply undo the transform.
    for (let i = 0; i < this._absoluteSources.length; ++i) {
      if (this._absoluteSources[i] == aSource) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Create a BasicSourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @param String aSourceMapURL
   *        The URL at which the source map can be found (optional)
   * @returns BasicSourceMapConsumer
   */
  static fromSourceMap(aSourceMap, aSourceMapURL) {
    return new BasicSourceMapConsumer(aSourceMap.toString());
  }

  get sources() {
    return this._absoluteSources.slice();
  }

  _getMappingsPtr() {
    if (this._mappingsPtr === 0) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this._mappingsPtr;
  }

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  _parseMappings(aStr, aSourceRoot) {
    const size = aStr.length;

    const mappingsBufPtr = this._wasm.exports.allocate_mappings(size);
    const mappingsBuf = new Uint8Array(this._wasm.exports.memory.buffer, mappingsBufPtr, size);
    for (let i = 0; i < size; i++) {
      mappingsBuf[i] = aStr.charCodeAt(i);
    }

    const mappingsPtr = this._wasm.exports.parse_mappings(mappingsBufPtr);

    if (!mappingsPtr) {
      const error = this._wasm.exports.get_last_error();
      let msg = `Error parsing mappings (code ${error}): `;

      // XXX: keep these error codes in sync with `fitzgen/source-map-mappings`.
      switch (error) {
        case 1:
          msg += "the mappings contained a negative line, column, source index, or name index";
          break;
        case 2:
          msg += "the mappings contained a number larger than 2**32";
          break;
        case 3:
          msg += "reached EOF while in the middle of parsing a VLQ";
          break;
        case 4:
          msg += "invalid base 64 character while parsing a VLQ";
          break;
        default:
          msg += "unknown error code";
          break;
      }

      throw new Error(msg);
    }

    this._mappingsPtr = mappingsPtr;
  }

  eachMapping(aCallback, aContext, aOrder) {
    const context = aContext || null;
    const order = aOrder || SourceMapConsumer.GENERATED_ORDER;
    const sourceRoot = this.sourceRoot;

    this._wasm.withMappingCallback(
      mapping => {
        if (mapping.source !== null) {
          mapping.source = this._sources.at(mapping.source);
          mapping.source = util$1.computeSourceURL(sourceRoot, mapping.source, this._sourceMapURL);

          if (mapping.name !== null) {
            mapping.name = this._names.at(mapping.name);
          }
        }

        aCallback.call(context, mapping);
      },
      () => {
        switch (order) {
        case SourceMapConsumer.GENERATED_ORDER:
          this._wasm.exports.by_generated_location(this._getMappingsPtr());
          break;
        case SourceMapConsumer.ORIGINAL_ORDER:
          this._wasm.exports.by_original_location(this._getMappingsPtr());
          break;
        default:
          throw new Error("Unknown order of iteration.");
        }
      }
    );
  }

  allGeneratedPositionsFor(aArgs) {
    let source = util$1.getArg(aArgs, "source");
    const originalLine = util$1.getArg(aArgs, "line");
    const originalColumn = aArgs.column || 0;

    source = this._findSourceIndex(source);
    if (source < 0) {
      return [];
    }

    if (originalLine < 1) {
      throw new Error("Line numbers must be >= 1");
    }

    if (originalColumn < 0) {
      throw new Error("Column numbers must be >= 0");
    }

    const mappings = [];

    this._wasm.withMappingCallback(
      m => {
        let lastColumn = m.lastGeneratedColumn;
        if (this._computedColumnSpans && lastColumn === null) {
          lastColumn = Infinity;
        }
        mappings.push({
          line: m.generatedLine,
          column: m.generatedColumn,
          lastColumn,
        });
      }, () => {
        this._wasm.exports.all_generated_locations_for(
          this._getMappingsPtr(),
          source,
          originalLine - 1,
          "column" in aArgs,
          originalColumn
        );
      }
    );

    return mappings;
  }

  destroy() {
    if (this._mappingsPtr !== 0) {
      this._wasm.exports.free_mappings(this._mappingsPtr);
      this._mappingsPtr = 0;
    }
  }

  /**
   * Compute the last column for each generated mapping. The last column is
   * inclusive.
   */
  computeColumnSpans() {
    if (this._computedColumnSpans) {
      return;
    }

    this._wasm.exports.compute_column_spans(this._getMappingsPtr());
    this._computedColumnSpans = true;
  }

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.  The line number
   *     is 1-based.
   *   - column: The column number in the generated source.  The column
   *     number is 0-based.
   *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
   *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.  The
   *     line number is 1-based.
   *   - column: The column number in the original source, or null.  The
   *     column number is 0-based.
   *   - name: The original identifier, or null.
   */
  originalPositionFor(aArgs) {
    const needle = {
      generatedLine: util$1.getArg(aArgs, "line"),
      generatedColumn: util$1.getArg(aArgs, "column")
    };

    if (needle.generatedLine < 1) {
      throw new Error("Line numbers must be >= 1");
    }

    if (needle.generatedColumn < 0) {
      throw new Error("Column numbers must be >= 0");
    }

    let bias = util$1.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND);
    if (bias == null) {
      bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
    }

    let mapping;
    this._wasm.withMappingCallback(m => mapping = m, () => {
      this._wasm.exports.original_location_for(
        this._getMappingsPtr(),
        needle.generatedLine - 1,
        needle.generatedColumn,
        bias
      );
    });

    if (mapping) {
      if (mapping.generatedLine === needle.generatedLine) {
        let source = util$1.getArg(mapping, "source", null);
        if (source !== null) {
          source = this._sources.at(source);
          source = util$1.computeSourceURL(this.sourceRoot, source, this._sourceMapURL);
        }

        let name = util$1.getArg(mapping, "name", null);
        if (name !== null) {
          name = this._names.at(name);
        }

        return {
          source,
          line: util$1.getArg(mapping, "originalLine", null),
          column: util$1.getArg(mapping, "originalColumn", null),
          name
        };
      }
    }

    return {
      source: null,
      line: null,
      column: null,
      name: null
    };
  }

  /**
   * Return true if we have the source content for every source in the source
   * map, false otherwise.
   */
  hasContentsOfAllSources() {
    if (!this.sourcesContent) {
      return false;
    }
    return this.sourcesContent.length >= this._sources.size() &&
      !this.sourcesContent.some(function(sc) { return sc == null; });
  }

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * available.
   */
  sourceContentFor(aSource, nullOnMissing) {
    if (!this.sourcesContent) {
      return null;
    }

    const index = this._findSourceIndex(aSource);
    if (index >= 0) {
      return this.sourcesContent[index];
    }

    let relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util$1.relative(this.sourceRoot, relativeSource);
    }

    let url;
    if (this.sourceRoot != null
        && (url = util$1.urlParse(this.sourceRoot))) {
      // XXX: file:// URIs and absolute paths lead to unexpected behavior for
      // many users. We can help them out when they expect file:// URIs to
      // behave like it would if they were running a local HTTP server. See
      // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
      const fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
      if (url.scheme == "file"
          && this._sources.has(fileUriAbsPath)) {
        return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
      }

      if ((!url.path || url.path == "/")
          && this._sources.has("/" + relativeSource)) {
        return this.sourcesContent[this._sources.indexOf("/" + relativeSource)];
      }
    }

    // This function is used recursively from
    // IndexedSourceMapConsumer.prototype.sourceContentFor. In that case, we
    // don't want to throw if we can't find the source - we just want to
    // return null, so we provide a flag to exit gracefully.
    if (nullOnMissing) {
      return null;
    }

    throw new Error('"' + relativeSource + '" is not in the SourceMap.');
  }

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.  The line number
   *     is 1-based.
   *   - column: The column number in the original source.  The column
   *     number is 0-based.
   *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
   *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.  The
   *     line number is 1-based.
   *   - column: The column number in the generated source, or null.
   *     The column number is 0-based.
   */
  generatedPositionFor(aArgs) {
    let source = util$1.getArg(aArgs, "source");
    source = this._findSourceIndex(source);
    if (source < 0) {
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    }

    const needle = {
      source,
      originalLine: util$1.getArg(aArgs, "line"),
      originalColumn: util$1.getArg(aArgs, "column")
    };

    if (needle.originalLine < 1) {
      throw new Error("Line numbers must be >= 1");
    }

    if (needle.originalColumn < 0) {
      throw new Error("Column numbers must be >= 0");
    }

    let bias = util$1.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND);
    if (bias == null) {
      bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
    }

    let mapping;
    this._wasm.withMappingCallback(m => mapping = m, () => {
      this._wasm.exports.generated_location_for(
        this._getMappingsPtr(),
        needle.source,
        needle.originalLine - 1,
        needle.originalColumn,
        bias
      );
    });

    if (mapping) {
      if (mapping.source === needle.source) {
        let lastColumn = mapping.lastGeneratedColumn;
        if (this._computedColumnSpans && lastColumn === null) {
          lastColumn = Infinity;
        }
        return {
          line: util$1.getArg(mapping, "generatedLine", null),
          column: util$1.getArg(mapping, "generatedColumn", null),
          lastColumn,
        };
      }
    }

    return {
      line: null,
      column: null,
      lastColumn: null
    };
  }
}

BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
sourceMapConsumer.BasicSourceMapConsumer = BasicSourceMapConsumer;

/**
 * An IndexedSourceMapConsumer instance represents a parsed source map which
 * we can query for information. It differs from BasicSourceMapConsumer in
 * that it takes "indexed" source maps (i.e. ones with a "sections" field) as
 * input.
 *
 * The first parameter is a raw source map (either as a JSON string, or already
 * parsed to an object). According to the spec for indexed source maps, they
 * have the following attributes:
 *
 *   - version: Which version of the source map spec this map is following.
 *   - file: Optional. The generated file this source map is associated with.
 *   - sections: A list of section definitions.
 *
 * Each value under the "sections" field has two fields:
 *   - offset: The offset into the original specified at which this section
 *       begins to apply, defined as an object with a "line" and "column"
 *       field.
 *   - map: A source map definition. This source map could also be indexed,
 *       but doesn't have to be.
 *
 * Instead of the "map" field, it's also possible to have a "url" field
 * specifying a URL to retrieve a source map from, but that's currently
 * unsupported.
 *
 * Here's an example source map, taken from the source map spec[0], but
 * modified to omit a section which uses the "url" field.
 *
 *  {
 *    version : 3,
 *    file: "app.js",
 *    sections: [{
 *      offset: {line:100, column:10},
 *      map: {
 *        version : 3,
 *        file: "section.js",
 *        sources: ["foo.js", "bar.js"],
 *        names: ["src", "maps", "are", "fun"],
 *        mappings: "AAAA,E;;ABCDE;"
 *      }
 *    }],
 *  }
 *
 * The second parameter, if given, is a string whose value is the URL
 * at which the source map was found.  This URL is used to compute the
 * sources array.
 *
 * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
 */
class IndexedSourceMapConsumer extends SourceMapConsumer {
  constructor(aSourceMap, aSourceMapURL) {
    return super(INTERNAL).then(that => {
      let sourceMap = aSourceMap;
      if (typeof aSourceMap === "string") {
        sourceMap = util$1.parseSourceMapInput(aSourceMap);
      }

      const version = util$1.getArg(sourceMap, "version");
      const sections = util$1.getArg(sourceMap, "sections");

      if (version != that._version) {
        throw new Error("Unsupported version: " + version);
      }

      that._sources = new ArraySet();
      that._names = new ArraySet();
      that.__generatedMappings = null;
      that.__originalMappings = null;
      that.__generatedMappingsUnsorted = null;
      that.__originalMappingsUnsorted = null;

      let lastOffset = {
        line: -1,
        column: 0
      };
      return Promise.all(sections.map(s => {
        if (s.url) {
          // The url field will require support for asynchronicity.
          // See https://github.com/mozilla/source-map/issues/16
          throw new Error("Support for url field in sections not implemented.");
        }
        const offset = util$1.getArg(s, "offset");
        const offsetLine = util$1.getArg(offset, "line");
        const offsetColumn = util$1.getArg(offset, "column");

        if (offsetLine < lastOffset.line ||
            (offsetLine === lastOffset.line && offsetColumn < lastOffset.column)) {
          throw new Error("Section offsets must be ordered and non-overlapping.");
        }
        lastOffset = offset;

        const cons = new SourceMapConsumer(util$1.getArg(s, "map"), aSourceMapURL);
        return cons.then(consumer => {
          return {
            generatedOffset: {
              // The offset fields are 0-based, but we use 1-based indices when
              // encoding/decoding from VLQ.
              generatedLine: offsetLine + 1,
              generatedColumn: offsetColumn + 1
            },
            consumer
          };
        });
      })).then(s => {
        that._sections = s;
        return that;
      });
    });
  }

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.
  get _generatedMappings() {
    if (!this.__generatedMappings) {
      this._sortGeneratedMappings();
    }

    return this.__generatedMappings;
  }

  get _originalMappings() {
    if (!this.__originalMappings) {
      this._sortOriginalMappings();
    }

    return this.__originalMappings;
  }

  get _generatedMappingsUnsorted() {
    if (!this.__generatedMappingsUnsorted) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this.__generatedMappingsUnsorted;
  }

  get _originalMappingsUnsorted() {
    if (!this.__originalMappingsUnsorted) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this.__originalMappingsUnsorted;
  }

  _sortGeneratedMappings() {
    const mappings = this._generatedMappingsUnsorted;
    mappings.sort(util$1.compareByGeneratedPositionsDeflated);
    this.__generatedMappings = mappings;
  }

  _sortOriginalMappings() {
    const mappings = this._originalMappingsUnsorted;
    mappings.sort(util$1.compareByOriginalPositions);
    this.__originalMappings = mappings;
  }

  /**
   * The list of original sources.
   */
  get sources() {
    const sources = [];
    for (let i = 0; i < this._sections.length; i++) {
      for (let j = 0; j < this._sections[i].consumer.sources.length; j++) {
        sources.push(this._sections[i].consumer.sources[j]);
      }
    }
    return sources;
  }

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.  The line number
   *     is 1-based.
   *   - column: The column number in the generated source.  The column
   *     number is 0-based.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.  The
   *     line number is 1-based.
   *   - column: The column number in the original source, or null.  The
   *     column number is 0-based.
   *   - name: The original identifier, or null.
   */
  originalPositionFor(aArgs) {
    const needle = {
      generatedLine: util$1.getArg(aArgs, "line"),
      generatedColumn: util$1.getArg(aArgs, "column")
    };

    // Find the section containing the generated position we're trying to map
    // to an original position.
    const sectionIndex = binarySearch.search(needle, this._sections,
      function(aNeedle, section) {
        const cmp = aNeedle.generatedLine - section.generatedOffset.generatedLine;
        if (cmp) {
          return cmp;
        }

        return (aNeedle.generatedColumn -
                section.generatedOffset.generatedColumn);
      });
    const section = this._sections[sectionIndex];

    if (!section) {
      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    }

    return section.consumer.originalPositionFor({
      line: needle.generatedLine -
        (section.generatedOffset.generatedLine - 1),
      column: needle.generatedColumn -
        (section.generatedOffset.generatedLine === needle.generatedLine
         ? section.generatedOffset.generatedColumn - 1
         : 0),
      bias: aArgs.bias
    });
  }

  /**
   * Return true if we have the source content for every source in the source
   * map, false otherwise.
   */
  hasContentsOfAllSources() {
    return this._sections.every(function(s) {
      return s.consumer.hasContentsOfAllSources();
    });
  }

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * available.
   */
  sourceContentFor(aSource, nullOnMissing) {
    for (let i = 0; i < this._sections.length; i++) {
      const section = this._sections[i];

      const content = section.consumer.sourceContentFor(aSource, true);
      if (content) {
        return content;
      }
    }
    if (nullOnMissing) {
      return null;
    }
    throw new Error('"' + aSource + '" is not in the SourceMap.');
  }

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.  The line number
   *     is 1-based.
   *   - column: The column number in the original source.  The column
   *     number is 0-based.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.  The
   *     line number is 1-based.
   *   - column: The column number in the generated source, or null.
   *     The column number is 0-based.
   */
  generatedPositionFor(aArgs) {
    for (let i = 0; i < this._sections.length; i++) {
      const section = this._sections[i];

      // Only consider this section if the requested source is in the list of
      // sources of the consumer.
      if (section.consumer._findSourceIndex(util$1.getArg(aArgs, "source")) === -1) {
        continue;
      }
      const generatedPosition = section.consumer.generatedPositionFor(aArgs);
      if (generatedPosition) {
        const ret = {
          line: generatedPosition.line +
            (section.generatedOffset.generatedLine - 1),
          column: generatedPosition.column +
            (section.generatedOffset.generatedLine === generatedPosition.line
             ? section.generatedOffset.generatedColumn - 1
             : 0)
        };
        return ret;
      }
    }

    return {
      line: null,
      column: null
    };
  }

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  _parseMappings(aStr, aSourceRoot) {
    const generatedMappings = this.__generatedMappingsUnsorted = [];
    const originalMappings = this.__originalMappingsUnsorted = [];
    for (let i = 0; i < this._sections.length; i++) {
      const section = this._sections[i];

      const sectionMappings = [];
      section.consumer.eachMapping(m => sectionMappings.push(m));

      for (let j = 0; j < sectionMappings.length; j++) {
        const mapping = sectionMappings[j];

        // TODO: test if null is correct here.  The original code used
        // `source`, which would actually have gotten used as null because
        // var's get hoisted.
        // See: https://github.com/mozilla/source-map/issues/333
        let source = util$1.computeSourceURL(section.consumer.sourceRoot, null, this._sourceMapURL);
        this._sources.add(source);
        source = this._sources.indexOf(source);

        let name = null;
        if (mapping.name) {
          this._names.add(mapping.name);
          name = this._names.indexOf(mapping.name);
        }

        // The mappings coming from the consumer for the section have
        // generated positions relative to the start of the section, so we
        // need to offset them to be relative to the start of the concatenated
        // generated file.
        const adjustedMapping = {
          source,
          generatedLine: mapping.generatedLine +
            (section.generatedOffset.generatedLine - 1),
          generatedColumn: mapping.generatedColumn +
            (section.generatedOffset.generatedLine === mapping.generatedLine
            ? section.generatedOffset.generatedColumn - 1
            : 0),
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name
        };

        generatedMappings.push(adjustedMapping);
        if (typeof adjustedMapping.originalLine === "number") {
          originalMappings.push(adjustedMapping);
        }
      }
    }
  }

  eachMapping(aCallback, aContext, aOrder) {
    const context = aContext || null;
    const order = aOrder || SourceMapConsumer.GENERATED_ORDER;

    let mappings;
    switch (order) {
    case SourceMapConsumer.GENERATED_ORDER:
      mappings = this._generatedMappings;
      break;
    case SourceMapConsumer.ORIGINAL_ORDER:
      mappings = this._originalMappings;
      break;
    default:
      throw new Error("Unknown order of iteration.");
    }

    const sourceRoot = this.sourceRoot;
    mappings.map(function(mapping) {
      let source = null;
      if (mapping.source !== null) {
        source = this._sources.at(mapping.source);
        source = util$1.computeSourceURL(sourceRoot, source, this._sourceMapURL);
      }
      return {
        source,
        generatedLine: mapping.generatedLine,
        generatedColumn: mapping.generatedColumn,
        originalLine: mapping.originalLine,
        originalColumn: mapping.originalColumn,
        name: mapping.name === null ? null : this._names.at(mapping.name)
      };
    }, this).forEach(aCallback, context);
  }

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  _findMapping(aNeedle, aMappings, aLineName,
              aColumnName, aComparator, aBias) {
    // To return the position we are searching for, we must first find the
    // mapping for the given position and then return the opposite position it
    // points to. Because the mappings are sorted, we can use binary search to
    // find the best mapping.

    if (aNeedle[aLineName] <= 0) {
      throw new TypeError("Line must be greater than or equal to 1, got "
                          + aNeedle[aLineName]);
    }
    if (aNeedle[aColumnName] < 0) {
      throw new TypeError("Column must be greater than or equal to 0, got "
                          + aNeedle[aColumnName]);
    }

    return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
  }

  allGeneratedPositionsFor(aArgs) {
    const line = util$1.getArg(aArgs, "line");

    // When there is no exact match, BasicSourceMapConsumer.prototype._findMapping
    // returns the index of the closest mapping less than the needle. By
    // setting needle.originalColumn to 0, we thus find the last mapping for
    // the given line, provided such a mapping exists.
    const needle = {
      source: util$1.getArg(aArgs, "source"),
      originalLine: line,
      originalColumn: util$1.getArg(aArgs, "column", 0)
    };

    needle.source = this._findSourceIndex(needle.source);
    if (needle.source < 0) {
      return [];
    }

    if (needle.originalLine < 1) {
      throw new Error("Line numbers must be >= 1");
    }

    if (needle.originalColumn < 0) {
      throw new Error("Column numbers must be >= 0");
    }

    const mappings = [];

    let index = this._findMapping(needle,
                                  this._originalMappings,
                                  "originalLine",
                                  "originalColumn",
                                  util$1.compareByOriginalPositions,
                                  binarySearch.LEAST_UPPER_BOUND);
    if (index >= 0) {
      let mapping = this._originalMappings[index];

      if (aArgs.column === undefined) {
        const originalLine = mapping.originalLine;

        // Iterate until either we run out of mappings, or we run into
        // a mapping for a different line than the one we found. Since
        // mappings are sorted, this is guaranteed to find all mappings for
        // the line we found.
        while (mapping && mapping.originalLine === originalLine) {
          let lastColumn = mapping.lastGeneratedColumn;
          if (this._computedColumnSpans && lastColumn === null) {
            lastColumn = Infinity;
          }
          mappings.push({
            line: util$1.getArg(mapping, "generatedLine", null),
            column: util$1.getArg(mapping, "generatedColumn", null),
            lastColumn,
          });

          mapping = this._originalMappings[++index];
        }
      } else {
        const originalColumn = mapping.originalColumn;

        // Iterate until either we run out of mappings, or we run into
        // a mapping for a different line than the one we were searching for.
        // Since mappings are sorted, this is guaranteed to find all mappings for
        // the line we are searching for.
        while (mapping &&
               mapping.originalLine === line &&
               mapping.originalColumn == originalColumn) {
          let lastColumn = mapping.lastGeneratedColumn;
          if (this._computedColumnSpans && lastColumn === null) {
            lastColumn = Infinity;
          }
          mappings.push({
            line: util$1.getArg(mapping, "generatedLine", null),
            column: util$1.getArg(mapping, "generatedColumn", null),
            lastColumn,
          });

          mapping = this._originalMappings[++index];
        }
      }
    }

    return mappings;
  }

  destroy() {
    for (let i = 0; i < this._sections.length; i++) {
      this._sections[i].consumer.destroy();
    }
  }
}
sourceMapConsumer.IndexedSourceMapConsumer = IndexedSourceMapConsumer;

/*
 * Cheat to get around inter-twingled classes.  `factory()` can be at the end
 * where it has access to non-hoisted classes, but it gets hoisted itself.
 */
function _factory(aSourceMap, aSourceMapURL) {
  let sourceMap = aSourceMap;
  if (typeof aSourceMap === "string") {
    sourceMap = util$1.parseSourceMapInput(aSourceMap);
  }

  const consumer = sourceMap.sections != null
      ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL)
      : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
  return Promise.resolve(consumer);
}

function _factoryBSM(aSourceMap, aSourceMapURL) {
  return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
}

var sourceNode = {};

/* -*- Mode: js; js-indent-level: 2; -*- */

/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

const SourceMapGenerator = sourceMapGenerator.SourceMapGenerator;
const util = util$4;

// Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
// operating systems these days (capturing the result).
const REGEX_NEWLINE = /(\r?\n)/;

// Newline character code for charCodeAt() comparisons
const NEWLINE_CODE = 10;

// Private symbol for identifying `SourceNode`s when multiple versions of
// the source-map library are loaded. This MUST NOT CHANGE across
// versions!
const isSourceNode = "$$$isSourceNode$$$";

/**
 * SourceNodes provide a way to abstract over interpolating/concatenating
 * snippets of generated JavaScript source code while maintaining the line and
 * column information associated with the original source code.
 *
 * @param aLine The original line number.
 * @param aColumn The original column number.
 * @param aSource The original source's filename.
 * @param aChunks Optional. An array of strings which are snippets of
 *        generated JS, or other SourceNodes.
 * @param aName The original identifier.
 */
class SourceNode$1 {
  constructor(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    this[isSourceNode] = true;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   * @param aRelativePath Optional. The path that relative sources in the
   *        SourceMapConsumer should be relative to.
   */
  static fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
    // The SourceNode we want to fill with the generated code
    // and the SourceMap
    const node = new SourceNode$1();

    // All even indices of this array are one line of the generated code,
    // while all odd indices are the newlines between two adjacent lines
    // (since `REGEX_NEWLINE` captures its match).
    // Processed fragments are accessed by calling `shiftNextLine`.
    const remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
    let remainingLinesIndex = 0;
    const shiftNextLine = function() {
      const lineContents = getNextLine();
      // The last line of a file might not have a newline.
      const newLine = getNextLine() || "";
      return lineContents + newLine;

      function getNextLine() {
        return remainingLinesIndex < remainingLines.length ?
            remainingLines[remainingLinesIndex++] : undefined;
      }
    };

    // We need to remember the position of "remainingLines"
    let lastGeneratedLine = 1, lastGeneratedColumn = 0;

    // The generate SourceNodes we need a code range.
    // To extract it current and last mapping is used.
    // Here we store the last mapping.
    let lastMapping = null;
    let nextLine;

    aSourceMapConsumer.eachMapping(function(mapping) {
      if (lastMapping !== null) {
        // We add the code from "lastMapping" to "mapping":
        // First check if there is a new line in between.
        if (lastGeneratedLine < mapping.generatedLine) {
          // Associate first line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
          lastGeneratedLine++;
          lastGeneratedColumn = 0;
          // The remaining code is added without mapping
        } else {
          // There is no new line in between.
          // Associate the code between "lastGeneratedColumn" and
          // "mapping.generatedColumn" with "lastMapping"
          nextLine = remainingLines[remainingLinesIndex] || "";
          const code = nextLine.substr(0, mapping.generatedColumn -
                                        lastGeneratedColumn);
          remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn -
                                              lastGeneratedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
          addMappingWithCode(lastMapping, code);
          // No more remaining code, continue
          lastMapping = mapping;
          return;
        }
      }
      // We add the generated code until the first mapping
      // to the SourceNode without any mapping.
      // Each line is added as separate string.
      while (lastGeneratedLine < mapping.generatedLine) {
        node.add(shiftNextLine());
        lastGeneratedLine++;
      }
      if (lastGeneratedColumn < mapping.generatedColumn) {
        nextLine = remainingLines[remainingLinesIndex] || "";
        node.add(nextLine.substr(0, mapping.generatedColumn));
        remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
        lastGeneratedColumn = mapping.generatedColumn;
      }
      lastMapping = mapping;
    }, this);
    // We have processed all mappings.
    if (remainingLinesIndex < remainingLines.length) {
      if (lastMapping) {
        // Associate the remaining code in the current line with "lastMapping"
        addMappingWithCode(lastMapping, shiftNextLine());
      }
      // and add the remaining lines without any mapping
      node.add(remainingLines.splice(remainingLinesIndex).join(""));
    }

    // Copy sourcesContent into SourceNode
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      const content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        if (aRelativePath != null) {
          sourceFile = util.join(aRelativePath, sourceFile);
        }
        node.setSourceContent(sourceFile, content);
      }
    });

    return node;

    function addMappingWithCode(mapping, code) {
      if (mapping === null || mapping.source === undefined) {
        node.add(code);
      } else {
        const source = aRelativePath
          ? util.join(aRelativePath, mapping.source)
          : mapping.source;
        node.add(new SourceNode$1(mapping.originalLine,
                                mapping.originalColumn,
                                source,
                                code,
                                mapping.name));
      }
    }
  }

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function(chunk) {
        this.add(chunk);
      }, this);
    } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    } else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  }

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (let i = aChunk.length - 1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    } else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  }

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  walk(aFn) {
    let chunk;
    for (let i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk[isSourceNode]) {
        chunk.walk(aFn);
      } else if (chunk !== "") {
        aFn(chunk, { source: this.source,
                      line: this.line,
                      column: this.column,
                      name: this.name });
      }
    }
  }

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  join(aSep) {
    let newChildren;
    let i;
    const len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len - 1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  }

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  replaceRight(aPattern, aReplacement) {
    const lastChild = this.children[this.children.length - 1];
    if (lastChild[isSourceNode]) {
      lastChild.replaceRight(aPattern, aReplacement);
    } else if (typeof lastChild === "string") {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    } else {
      this.children.push("".replace(aPattern, aReplacement));
    }
    return this;
  }

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  setSourceContent(aSourceFile, aSourceContent) {
    this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
  }

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  walkSourceContents(aFn) {
    for (let i = 0, len = this.children.length; i < len; i++) {
      if (this.children[i][isSourceNode]) {
        this.children[i].walkSourceContents(aFn);
      }
    }

    const sources = Object.keys(this.sourceContents);
    for (let i = 0, len = sources.length; i < len; i++) {
      aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
    }
  }

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  toString() {
    let str = "";
    this.walk(function(chunk) {
      str += chunk;
    });
    return str;
  }

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  toStringWithSourceMap(aArgs) {
    const generated = {
      code: "",
      line: 1,
      column: 0
    };
    const map = new SourceMapGenerator(aArgs);
    let sourceMappingActive = false;
    let lastOriginalSource = null;
    let lastOriginalLine = null;
    let lastOriginalColumn = null;
    let lastOriginalName = null;
    this.walk(function(chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if (lastOriginalSource !== original.source
          || lastOriginalLine !== original.line
          || lastOriginalColumn !== original.column
          || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      for (let idx = 0, length = chunk.length; idx < length; idx++) {
        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
          generated.line++;
          generated.column = 0;
          // Mappings end at eol
          if (idx + 1 === length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column++;
        }
      }
    });
    this.walkSourceContents(function(sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map };
  }
}

sourceNode.SourceNode = SourceNode$1;

/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

sourceMap.SourceMapGenerator = sourceMapGenerator.SourceMapGenerator;
sourceMap.SourceMapConsumer = sourceMapConsumer.SourceMapConsumer;
sourceMap.SourceNode = sourceNode.SourceNode;

const { mapfn: mapfn$1, map: map$p } = beanParser;
const { SourceNode } = sourceMap;

const join = (arr, sep) => new SourceNode(null, null, null, arr).join(sep);
const asIs = (token) =>
  new SourceNode(token.line, token.column, token.file, token.value);

const conditionals$1 = ["fullConditional", "conditional"];

const checkLambda = (node, body, getValue, getBody) => {
  if (node.lambda?.length) {
    return get({
      type: "lambda",
      body: getBody ? get(body) : body,
      params: node.lambda,
    });
  }
  return getValue ? get(node) : node;
};

const getCallFn = (node) => {
  if (node.fn.type === "method") {
    if (!node.isMap)
      return {
        type: "propertyAccess",
        lhs: node.args.shift(),
        dot: node.fn.dot,
        rhs: node.fn.property,
      };
    if (node.args.length > 1)
      return {
        type: "propertyAccess",
        lhs: { type: "symbol", value: "$item" },
        dot: node.fn.dot,
        rhs: node.fn.property,
        dropData: true,
        dropMeta: true,
      };
    return {
      type: "wrapped",
      start: { value: "(" },
      end: { value: ")" },
      content: {
        type: "function",
        start: node.fn,
        noParallel: true,
        name: "",
        needsAsync: node.needsAsync,
        params: [get({ type: "symbol", value: "$item" })],
        body: get({
          type: "return",
          content: [
            {
              type: "call",
              fn: {
                type: "propertyAccess",
                lhs: { type: "symbol", value: "$item" },
                dot: node.fn.dot,
                rhs: node.fn.property,
              },
              args: [],
            },
          ],
        }),
      },
    };
  }
  return node.fn;
};

const types$g = {
  symbol(node) {
    return asIs(node);
  },
  number(node) {
    return new SourceNode(
      node.line,
      node.column,
      node.file,
      node.value.replace(/_/g, "")
    );
  },
  awaited(node) {
    const value = node.all
      ? ["Promise.all(", get(node.value), ")"]
      : [get(node.value)];
    if (node.await.value.startsWith("["))
      node.await.value = node.await.value.slice(1, -1);
    const sn = new SourceNode(
      node.await.line,
      node.await.column,
      node.await.file,
      ["(", asIs(node.await), " ", ...value, ")"]
    );
    sn.needsAsync = true;
    return sn;
  },
  mapCall(node) {
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const args = node.args.map(get);
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    if (fn.insertBefore) insertBefore.unshift(fn.insertBefore);
    const data = args.shift();
    const needsAsync = data.needsAsync || args.some((arg) => arg.needsAsync);
    let fun;
    if (args.length) {
      fun = new SourceNode(null, null, null, [
        needsAsync ? "async " : "",
        "($item",
        fn.dropMeta ? ")=>" : ", $index, $iterator)=>",
        get(fn),
        fn.dropData ? "(" : "($item,",
        join(args, ","),
        fn.dropMeta ? ")" : ",$index,$iterator)",
      ]);
    } else {
      fun = get(fn);
    }
    if (fun.insertBefore) insertBefore.unshift(fun.insertBefore);
    let sn = new SourceNode(fn.line, fn.column, fn.file, [
      data,
      ".",
      "map",
      "(",
      fun,
      ")",
    ]);
    if (awaited) {
      const value = all ? ["Promise.all(", sn, ")"] : [sn];
      if (node.await.value.startsWith("["))
        node.await.value = node.await.value.slice(1, -1);
      sn = new SourceNode(node.await.line, node.await.column, node.await.file, [
        "(",
        asIs(node.await),
        " ",
        ...value,
        ")",
      ]);
    }
    if (insertBefore.length) sn.insertBefore = insertBefore;
    sn.needsAsync =
      awaited ||
      data.needsAsync ||
      args.some((arg) => arg.needsAsync) ||
      fun.needsAsync;
    return sn;
  },
  call(node) {
    if (node.isMap) {
      node.type = "mapCall";
      return get(node);
    }
    const { awaited, all } = node;
    const fn = getCallFn(node);
    const args = node.args.map(get);
    const insertBefore = args.map((arg) => arg.insertBefore).filter(Boolean);
    const fun = get(fn);
    if (fun.insertBefore) insertBefore.unshift(fun.insertBefore);
    let sn = new SourceNode(fn.line, fn.column, fn.file, [
      fun,
      "(",
      join(args, ","),
      ")",
    ]);
    if (awaited) {
      const value = all ? ["Promise.all(", sn, ")"] : [sn];
      if (node.await.value.startsWith("["))
        node.await.value = node.await.value.slice(1, -1);
      sn = new SourceNode(node.await.line, node.await.column, node.await.file, [
        "(",
        asIs(node.await),
        " ",
        ...value,
        ")",
      ]);
    }
    if (insertBefore.length) sn.insertBefore = insertBefore;
    sn.needsAsync =
      awaited || args.some((arg) => arg.needsAsync) || fun.needsAsync;
    return sn;
  },
  ...mapfn$1(["add", "mul", "div", "sub", "mod", "pow"], (key) => [
    key,
    (node) => {
      const { op, lhs, rhs } = node;
      return new SourceNode(null, null, null, [
        lhs,
        new SourceNode(op.line, op.column, op.file, op.value),
        rhs,
      ]);
    },
  ]),
  math(node) {
    return node.value;
  },
  block(node) {
    const content = node.content
      .map(get)
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    const sn = new SourceNode(null, null, null, [
      new SourceNode(null, null, null, content).join(";"),
    ]);
    sn.needsAsync = content.some((item) => item.needsAsync);
    return sn;
  },
  return(node) {
    let lastNode = node.content.pop();
    let addReturn = true;
    const content = node.content
      .map(get)
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    if (conditionals$1.includes(lastNode.type)) {
      lastNode.if.body.type = "return";
      lastNode.elseIfs.map((elseIf) => (elseIf.body.type = "return"));
      if (lastNode.else) lastNode.else.body.type = "return";
      addReturn = false;
    } else if (lastNode.type === "assignment") {
      if (lastNode.value.insertBefore)
        content.push(lastNode.value.insertBefore);
      content.push(get(lastNode));
      lastNode = lastNode.name;
    }
    let last = lastNode.type ? get(lastNode) : lastNode;
    if (last.returnAs) last = last.returnAs;
    const sn = new SourceNode(null, null, null, [
      new SourceNode(null, null, null, content).join(";"),
      ...(content.length ? [";"] : []),
      ...(last.insertBefore ? [last.insertBefore, ";"] : []),
      ...(addReturn ? ["return "] : []),
      last,
    ]);
    sn.needsAsync = last.needsAsync || content.some((item) => item.needsAsync);
    return sn;
  },
  function(node) {
    const { start, name, params, body } = node;
    const doc = node.doc ? [`;`, name, ".__doc__=`", asIs(node.doc), "`"] : [];
    const sn = new SourceNode(start.line, start.column, start.file, [
      ...(name ? ["const ", name, "="] : []),
      ...(name ? ["register"] : []),
      "(",
      ...(name ? ["`", start.file, "/", name, "`,"] : []),
      node.body.needsAsync ? "async" : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")=>",
      "{",
      body,
      "})",
      ...doc,
    ]);
    sn.needsAsync = false;
    sn.returnAs = new SourceNode(null, null, null, name);
    sn.returnAs.insertBefore = sn;
    sn.fn = {
      doc: node.doc,
      name,
    };
    return sn;
  },
  exportedFunction(node) {
    const fn = get(node.value);
    const sn = new SourceNode(
      node.export.line,
      node.export.column,
      node.export.file,
      ["clio.exports.", node.name, "=", node.name]
    );
    sn.insertBefore = [fn.insertBefore, fn].filter(Boolean);
    sn.fn = fn.fn;
    return sn;
  },
  exported(node) {
    const value = get(node.value);
    const sn = new SourceNode(
      node.export.line,
      node.export.column,
      node.export.file,
      ["clio.exports.", get(node.name), "=", get(node.name)]
    );
    sn.insertBefore = [value.insertBefore, value].filter(Boolean);
    return sn;
  },
  imported(node) {
    /* each import has 2 parts:
        1. import
        2. assign
    */
    const path = node.path.value.slice(1, -1).replace(/^[^:]*:/, "");
    const filename = path.split("/").pop();
    // Get the name, and make it pascalCase
    const name = filename
      .replace(/\.[^.]*$/, "")
      .split("/")
      .pop()
      .split(/[-._]+/)
      .filter(Boolean)
      .map((v, i) => (i > 0 ? v[0].toUpperCase() + v.slice(1) : v))
      .join("");
    const protocol =
      node.path.value.slice(1, -1).match(/^[^:]*(?=:)/)?.[0] || "clio";
    let require;
    /* We are clearly testing these in our unit tests,
       yet istanbul considers them untested branches,
       I have no idea why, I disabled istanbul checks
       here until I figure out why? */
    if (protocol === "js") {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["require(", '"', path, '")']
      );
    } /* istanbul ignore next */ else if (protocol === "clio") {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        [
          "await require(",
          '"',
          path + (path.endsWith(".clio") ? ".js" : ".clio.js"),
          '").exports(clio)',
        ]
      );
    } else {
      require = new SourceNode(
        node.import.line,
        node.import.column,
        node.import.file,
        ["await remote(clio,", '"', protocol + "://" + path, '")']
      );
    }
    let assign;
    if (!node.items) {
      assign = new SourceNode(null, null, null, ["const ", name, "="]);
    } else {
      let parts = [];
      let rest;
      for (const part of node.items) {
        if (part.type === "symbol") {
          parts.push(get(part));
        } else if (part.lhs.type === "symbol") {
          parts.push(
            new SourceNode(part.as.line, part.as.column, part.as.file, [
              get(part.lhs),
              ":",
              get(part.rhs),
            ])
          );
        } else {
          const name = get(part.rhs);
          rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
            "...",
            name,
          ]);
          rest.name = name;
        }
      }
      if (rest) parts.push(rest);
      assign =
        rest && parts.length == 1
          ? new SourceNode(null, null, null, ["const ", rest.name, "="])
          : new SourceNode(null, null, null, [
              "const{",
              new SourceNode(null, null, null, parts).join(","),
              "}=",
            ]);
    }
    return new SourceNode(null, null, null, [assign, require]);
  },
  lambda(node) {
    const { body } = node;
    const params = [];
    const added = new Set();
    for (const param of node.params) {
      if (!added.has(param.value)) {
        added.add(param.value);
        params.push(get(param));
      }
    }
    const start = node.params[0];
    return new SourceNode(start.line, start.column, start.file, [
      /* istanbul ignore next */
      body.needsAsync ? "async " : "",
      "(",
      new SourceNode(null, null, null, params).join(","),
      ")",
      "=>",
      body,
    ]);
  },
  parallelFn(node) {
    const { start, fn } = node;
    return new SourceNode(start.line, start.column, start.file, [
      fn,
      ".parallel",
    ]);
  },
  comparison(node) {
    const nodes = [];
    for (const { op } of node.comparisons)
      if (op.value === "==") op.value = "===";
    const first = node.comparisons.shift();
    let needsAsync = node.lhs.needsAsync;
    nodes.push(
      "(",
      node.lhs,
      new SourceNode(
        first.op.line,
        first.op.column,
        first.op.file,
        first.op.value
      ),
      first.rhs,
      ")"
    );
    let lhs = first.rhs;
    for (const { op, rhs } of node.comparisons) {
      needsAsync = needsAsync || lhs.needsAsync;
      nodes.push(
        "&&",
        "(",
        lhs,
        new SourceNode(op.line, op.column, op.file, op.value),
        rhs,
        ")"
      );
      lhs = rhs;
    }
    const sn = new SourceNode(null, null, null, nodes);
    sn.needsAsync = needsAsync;
    sn.lambda = node.lambda;
    return sn;
  },
  logicalNot(node) {
    const { rhs, op } = node;
    const sn = new SourceNode(op.line, op.column, op.file, [
      new SourceNode(op.line, op.column, op.file, "!"),
      "(",
      rhs,
      ")",
    ]);
    sn.needsAsync = rhs.needsAsync;
    return sn;
  },
  logical(node) {
    const { lhs, logicals } = node;
    const parts = [
      "(",
      lhs,
      ")",
      ...logicals
        .map(({ op, rhs }) => [
          new SourceNode(
            op.line,
            op.column,
            op.file,
            op.value === "and" ? "&&" : "||"
          ),
          "(",
          rhs,
          ")",
        ])
        .flat(),
    ];
    const sn = new SourceNode(null, null, null, parts);
    sn.needsAsync =
      lhs.needsAsync || logicals.some(({ rhs }) => rhs.needsAsync);
    return sn;
  },
  ifBlock(node) {
    const { start, condition } = node;
    const body = get(node.body);
    const sn = new SourceNode(null, null, null, [
      asIs(start),
      "(",
      condition,
      ")",
      "{",
      body,
      "}",
    ]);
    sn.needsAsync = body.needsAsync;
    return sn;
  },
  elseIfBlock(node) {
    const { start, condition } = node;
    const body = get(node.body);
    const sn = new SourceNode(null, null, null, [
      asIs(start),
      " ",
      asIs(node.if),
      "(",
      condition,
      ")",
      "{",
      body,
      "}",
    ]);
    sn.needsAsync = body.needsAsync;
    return sn;
  },
  elseBlock(node) {
    const body = get(node.body);
    const sn = new SourceNode(null, null, null, [
      asIs(node.start),
      "{",
      body,
      "}",
    ]);
    sn.needsAsync = body.needsAsync;
    return sn;
  },
  conditional(node) {
    const ifBlock = get(node.if);
    const elseIfBlocks = node.elseIfs.map(get);
    const sn = new SourceNode(null, null, null, [ifBlock, ...elseIfBlocks]);
    sn.needsAsync =
      ifBlock.needsAsync || elseIfBlocks.some((block) => block.needsAsync);
    return sn;
  },
  fullConditional(node) {
    const ifBlock = get(node.if);
    const elseIfBlocks = node.elseIfs.map(get);
    const elseBlock = get(node.else);
    const sn = new SourceNode(null, null, null, [
      ifBlock,
      ...elseIfBlocks,
      elseBlock,
    ]);
    sn.needsAsync =
      ifBlock.needsAsync ||
      elseBlock.needsAsync ||
      elseIfBlocks.some((block) => block.needsAsync);
    return sn;
  },
  array(node) {
    const { start, end, items } = node;
    const sn = new SourceNode(null, null, null, [
      asIs(start),
      new SourceNode(null, null, null, items).join(","),
      asIs(end),
    ]);
    const insertBefores = items
      .map((item) => item.insertBefore)
      .filter(Boolean);
    if (insertBefores.length)
      sn.insertBefore = new SourceNode(null, null, null, insertBefores).join(
        ";"
      );
    sn.needsAsync = items.some((item) => item.needsAsync);
    return sn;
  },
  keyValue(node) {
    const sn = new SourceNode(null, null, null, [node.key, ":", node.value]);
    sn.needsAsync = node.value.needsAsync;
    return sn;
  },
  string(node) {
    node.value = node.value
      .slice(1, -1)
      .replace(/`/g, "\\`")
      .replace(/\\"/, '"');
    node.value = "`" + node.value + "`";
    return asIs(node);
  },
  hashmap(node) {
    const sn = new SourceNode(
      node.start.line,
      node.start.column,
      node.start.file,
      ["{", new SourceNode(null, null, null, node.keyValues).join(","), "}"]
    );
    sn.needsAsync = node.keyValues.some((kv) => kv.needsAsync);
    return sn;
  },
  propertyAccess(node) {
    const lhs = get(node.lhs);
    const rhs = get(node.rhs);
    const sn = new SourceNode(null, null, null, [lhs, asIs(node.dot), rhs]);
    sn.insertBefore = [lhs.insertBefore, rhs.insertBefore].filter(Boolean);
    sn.insertBefore = sn.insertBefore.length ? sn.insertBefore : null;
    sn.needsAsync = lhs.needsAsync || rhs.needsAsync;
    return sn;
  },
  range(node) {
    const start = node.start || "0";
    const end = node.end || "Infinity";
    const step = node.step || "null";
    const { location } = node;
    const sn = new SourceNode(location.line, location.column, location.file, [
      "range",
      "(",
      start,
      ",",
      end,
      ",",
      step,
      ")",
    ]);
    sn.needsAsync =
      node.start?.needsAsync || node.end?.needsAsync || node.step?.needsAsync;
    return sn;
  },
  ...map$p(["rangeFull", "byRange", "rangeBy"], (node) => {
    node.type = "range";
    return get(node);
  }),
  ranger(node) {
    return get({ type: "range", location: node });
  },
  slice(node) {
    const { slicer, slicee } = node;
    const sn = new SourceNode(null, null, null, [slicee, slicer]);
    sn.needsAsync = slicer.needsAsync || slicee.needsAsync;
    return sn;
  },
  set(node) {
    const { start, items } = node;
    const sn = new SourceNode(start.line, start.column, start.file, [
      "new",
      " ",
      "Set",
      "(",
      "[",
      new SourceNode(null, null, null, items).join(","),
      "]",
      ")",
    ]);
    sn.needsAsync = items.some((item) => item.needsAsync);
    return sn;
  },
  wrapped(node) {
    if (!node.content) return new SourceNode(null, null, null, "");
    if (node.isFn && node.content.type === "call")
      node.content.args.map((arg) => (arg.lambda = []));
    const content = checkLambda(node.content, node.content, true, true);
    const sn = new SourceNode(null, null, null, [
      asIs(node.start),
      content,
      asIs(node.end),
    ]);
    sn.insertBefore = content.insertBefore;
    sn.needsAsync = content.needsAsync;
    return sn;
  },
  assignment(node) {
    const name = get(node.name);
    const sn = new SourceNode(null, null, null, [
      ...(node.name.type === "symbol" ? ["const", " "] : []),
      name,
      asIs(node.assign),
      node.value,
    ]);
    sn.insertBefore = node.value.insertBefore;
    sn.needsAsync = node.value.needsAsync;
    return sn;
  },
  arrowAssignment(node) {
    const name = get(node.name);
    const insertBefore = new SourceNode(null, null, null, [
      ...(node.name.type === "symbol" ? ["const", " "] : []),
      name,
      new SourceNode(node.arrow.line, node.arrow.column, node.arrow.file, "="),
      node.value,
    ]);
    const insertBefores = new SourceNode(
      null,
      null,
      null,
      [node.value.insertBefore, insertBefore].filter(Boolean)
    ).join(";");
    name.insertBefore = insertBefores;
    name.needsAsync = node.value.needsAsync;
    return name;
  },
  parameter(node) {
    return new SourceNode(
      node.line,
      node.column,
      node.file,
      node.value.slice(1)
    );
  },
  inCheck(node) {
    return new SourceNode(node.start.line, node.start.column, node.start.file, [
      "includes(",
      get(node.lhs),
      ",",
      get(node.rhs),
      ")",
    ]);
  },
  formattedString(node) {
    const fn = get(node.fn);
    const args = new SourceNode(null, null, null, node.args.map(get));
    return new SourceNode(null, null, null, [fn, "(", args.join(","), ")"]);
  },
  fmtStr(node) {
    return new SourceNode(node.line, node.column, node.file, [
      "`",
      node.value,
      "`",
    ]);
  },
  fmtExpr(node) {
    return node.content || "undefined";
  },
  strEscape(node) {
    node.value = node.value.slice(1);
    return new SourceNode(null, null, null, ["`", asIs(node), "`"]);
  },
  clio(node) {
    const content = node.content
      .map((node) => [node.insertBefore, node])
      .flat()
      .filter(Boolean);
    const inner = new SourceNode(null, null, null, content).join(";");
    return new SourceNode(null, null, null, [
      "module.exports.exports=async(clio)=>{const{emitter,channel,range,slice,remote,register,man,includes,f}=clio;",
      inner,
      ";return clio.exports}",
    ]);
  },
};

const get = (node) => {
  const result = types$g[node.type](node);
  result.node = node;
  return result;
};

types$h.checkLambda = checkLambda;
types$h.types = types$g;
types$h.get = get;

var common = {};

const { rule: rule$3, lPluck: lPluck$3, map: map$o } = beanParser;

const wrap$q = (fn, priority) =>
  rule$3((lhs, rhs) => {
    const result = fn(lhs, rhs);
    result.lambda = result.lambda || [];
    for (const it of [lhs, rhs]) {
      if (it.type == "wrapped") continue;
      if (it.type == "parameter") result.lambda.push(it);
      else if (it.lambda?.length) result.lambda.push(...it.lambda);
    }
    result.meta = {
      location: lhs.meta?.location || {
        file: lhs.file,
        line: lhs.line,
        column: lhs.column,
      },
    };
    return result;
  }, priority);

const ignore$b = (...rules) => map$o(rules, wrap$q(lPluck$3));

const ranges$1 = ["range", "rangeFull", "rangeBy", "byRange", "ranger"];

const values$g = [
  "symbol",
  "parameter",
  "number",
  "array",
  "string",
  "formattedString",
  "hashmap",
  "propertyAccess",
  ...ranges$1,
  "slice",
  "set",
  "wrapped",
  "awaited",
  "parallelFn",
  "null",
  "true",
  "false",
  "inCheck",
  "group",
];
const arrayLike$1 = ["array", "symbol", "propertyAccess", "slice"];
const expressions$c = [
  "math",
  "comparison",
  "logical",
  "logicalNot",
  "call",
  "arrowAssignment",
];
const controls = ["conditional", "fullConditional"];
const topLevels$2 = [
  ...controls,
  "function",
  ...values$g,
  "assignment",
  "arrowAssignment",
  ...expressions$c,
  "imported",
];

const lexerTokens$1 = [
  "if",
  "else",
  "fn",
  "await",
  "import",
  "as",
  "from",
  "export",
  "and",
  "or",
  "not",
  "by",
  "in",
  "number",
  "fmtStart",
  "fmtEnd",
  "strEscape",
  "fmtExprStart",
  "ender",
  "fmtExprEnd",
  "fmtStr",
  "format",
  "string",
  "comment",
  "outdent",
  "indent",
  "space",
  "awaitAll",
  "symbol",
  "parameter",
  "format",
  "slicer",
  "hash",
  "ranger",
  "dot",
  "pike",
  "lCurly",
  "rCurly",
  "lSquare",
  "rSquare",
  "lParen",
  "ender",
  "rParen",
  "colon",
  "arrow",
  "subOp",
  "addOp",
  "gte",
  "gt",
  "lte",
  "lt",
  "eq",
  "fatArrow",
  "assign",
  "divOp",
  "modOp",
  "powOp",
  "mulOp",
  "lineBreak",
  "groupOpen",
  "groupClose",
];

common.wrap = wrap$q;
common.ignore = ignore$b;
common.topLevels = topLevels$2;
common.controls = controls;
common.expressions = expressions$c;
common.arrayLike = arrayLike$1;
common.ranges = ranges$1;
common.values = values$g;
common.lexerTokens = lexerTokens$1;

const { map: map$n, merge: merge$3 } = beanParser;
const { wrap: wrap$p, values: values$f, expressions: expressions$b } = common;

var calls = merge$3(
  {
    // Calls
    ...map$n(
      [
        "symbol",
        "parallelFn",
        "propertyAccess",
        "method",
        "wrapped",
        "parameter",
      ],
      {
        ...map$n(
          [...values$f, ...expressions$b],
          wrap$p((lhs, rhs) => {
            lhs.isFn = true;
            return {
              type: "callOpen",
              fn: lhs,
              args: [rhs],
            };
          }, 3)
        ),
      }
    ),
    callOpen: {
      ...map$n(
        [...values$f, ...expressions$b],
        wrap$p((lhs, rhs) => {
          lhs.args.push(rhs);
          return lhs;
        }, 4)
      ),
      ...map$n(
        ["lineBreak", "ender"],
        wrap$p((lhs) => {
          lhs.type = "call";
          return lhs;
        }, 1)
      ),
    },
    pipeOpen: {
      call: wrap$p((lhs, rhs) => {
        rhs.args.unshift(lhs.data);
        rhs.isMap = lhs.isMap;
        rhs.isFlow = true;
        return rhs;
      }),
      ...map$n(
        [
          "symbol",
          "parallelFn",
          "method",
          "propertyAccess",
          "wrapped",
          "parameter",
        ],
        wrap$p((lhs, rhs) => {
          rhs.isFn = true;
          return {
            type: "callOpen",
            fn: rhs,
            args: [lhs.data],
            isMap: lhs.isMap,
            isFlow: true,
          };
        }, 1)
      ),
      awaited: wrap$p((lhs, rhs) => {
        const { data, isMap } = lhs;
        if (rhs.value.type.startsWith("call")) {
          rhs.value.args.unshift(data);
          rhs.value.isMap = isMap;
          rhs.value.awaited = true;
          rhs.value.await = rhs.await;
          rhs.value.all = rhs.all;
          rhs.value.isFlow = true;
          return rhs.value;
        }
        return {
          type: "call",
          fn: rhs.value,
          args: [data],
          isMap,
          awaited: true,
          all: rhs.all,
          await: rhs.await,
          isFlow: true,
        };
      }),
    },
    arrow: {
      mulOp: wrap$p((lhs, rhs) => {
        return { type: "mapArrow", arrow: lhs, map: rhs };
      }, 4),
    },
  },
  {
    // Calls
    ...map$n([...values$f, ...expressions$b, "data"], {
      arrow: wrap$p((lhs) => {
        return {
          type: "pipeOpen",
          data: lhs,
        };
      }, 0.31),
      mapArrow: wrap$p((lhs) => {
        return {
          type: "pipeOpen",
          data: lhs,
          isMap: true,
        };
      }, 0.31),
    }),
  }
);

const { topLevels: topLevels$1, wrap: wrap$o, ignore: ignore$a } = common;
const { map: map$m } = beanParser;

var blocks = {
  // Blocks
  lineBreak: {
    indent: wrap$o((_, rhs) => rhs, 99),
  },
  indent: {
    ...map$m(
      topLevels$1,
      wrap$o((_, rhs) => {
        return { type: "blockOpen", content: [rhs] };
      }, 0)
    ),
  },
  blockOpen: {
    ...ignore$a("lineBreak"),
    ...map$m(
      topLevels$1,
      wrap$o((lhs, rhs) => {
        lhs.content.push(rhs);
        return lhs;
      }, 0)
    ),
    outdent: wrap$o((lhs) => {
      lhs.type = "block";
      return lhs;
    }),
  },
};

const { wrap: wrap$n } = common;
const types$f = types$h;

var parallelFns = {
  // Parallel functions
  pike: {
    symbol: wrap$n((pike, rhs) => {
      return { type: "pikeOpen", fn: types$f.get(rhs), start: pike };
    }),
  },
  pikeOpen: {
    pike: wrap$n((lhs) => {
      return { type: "parallelFn", fn: lhs.fn, start: lhs.start };
    }),
  },
};

const { map: map$l } = beanParser;
const types$e = types$h;
const { expressions: expressions$a, wrap: wrap$m, values: values$e, ignore: ignore$9 } = common;

var functions = {
  // Functions
  fn: {
    symbol: wrap$m((lhs, rhs) => {
      return { start: lhs, type: "fnOpen", params: [], name: types$e.get(rhs) };
    }, 10),
  },
  fnOpen: {
    symbol: wrap$m((fn, rhs) => {
      fn.params.push(types$e.get(rhs));
      return fn;
    }, 10),
    colon: wrap$m((fn) => {
      fn.type = "fnTail";
      return fn;
    }),
  },
  fnTail: {
    ...ignore$9("lineBreak"),
    block: wrap$m((lhs, rhs) => {
      lhs.type = "function";
      rhs.type = "return";
      lhs.body = types$e.get(rhs);
      return lhs;
    }, 10),
    ...map$l(
      [...expressions$a, ...values$e],
      wrap$m((lhs, rhs) => {
        lhs.type = "function";
        lhs.body = types$e.get({ type: "return", content: [rhs] });
        return lhs;
      }, 0)
    ),
  },
  comment: {
    ...ignore$9("lineBreak"),
    function: wrap$m((lhs, rhs) => {
      rhs.doc = lhs;
      return rhs;
    }, 2),
    exportedFunction: wrap$m((lhs, rhs) => {
      rhs.value.doc = lhs;
      return rhs;
    }, 2),
  },
};

const { map: map$k, mapfn } = beanParser;
const types$d = types$h;
const { wrap: wrap$l, values: values$d, ignore: ignore$8 } = common;

var math = {
  // Math
  /*
    Even though we're doing a 1:1 translation to JavaScript
    and we do not care about op priorities, I decided to
    implement them anyways because that's the correct way
    of doing it.
  */
  ...map$k([...values$d, "math"], {
    powOp: wrap$l((lhs, op) => {
      return { type: "powLhs", lhs: types$d.get(lhs), op };
    }, 9),
    mulOp: wrap$l((lhs, op) => {
      return { type: "mulLhs", lhs: types$d.get(lhs), op };
    }, 8),
    divOp: wrap$l((lhs, op) => {
      return { type: "divLhs", lhs: types$d.get(lhs), op };
    }, 8),
    addOp: wrap$l((lhs, op) => {
      return { type: "addLhs", lhs: types$d.get(lhs), op };
    }, 7),
    subOp: wrap$l((lhs, op) => {
      return { type: "subLhs", lhs: types$d.get(lhs), op };
    }, 7),
    modOp: wrap$l((lhs, op) => {
      return { type: "modLhs", lhs: types$d.get(lhs), op };
    }, 7),
  }),
  ...mapfn(["add", "sub", "mul", "div", "pow", "mod"], (op) => [
    `${op}Lhs`,
    {
      ...ignore$8("lineBreak"),
      ...map$k(
        values$d,
        wrap$l((lhs, rhs) => {
          return {
            type: "math",
            value: types$d.get({
              type: op,
              op: lhs.op,
              lhs: lhs.lhs,
              rhs: types$d.get(rhs),
            }),
          };
        }, 10)
      ),
    },
  ]),
};

const { map: map$j } = beanParser;
const types$c = types$h;
const { expressions: expressions$9, wrap: wrap$k, values: values$c, ignore: ignore$7 } = common;

var comparisons = {
  // Comparisons
  ...map$j([...values$c, ...expressions$9], {
    ...map$j(
      ["eq", "gt", "lt", "gte", "lte"],
      wrap$k((lhs, op) => {
        return {
          type: "comparisonOpen",
          lhs: types$c.get(lhs),
          op,
          comparisons: [],
        };
      }, 5)
    ),
  }),
  comparisonOpen: {
    ...ignore$7("lineBreak"),
    ...map$j(
      [...values$c, ...expressions$9],
      wrap$k((lhs, rhs) => {
        return {
          type: "comparison",
          lhs: lhs.lhs,
          comparisons: [
            ...lhs.comparisons,
            { op: lhs.op, rhs: types$c.get(rhs) },
          ],
        };
      }, 6)
    ),
  },
  comparison: {
    ...ignore$7("lineBreak"),
    ...map$j(
      ["eq", "gt", "lt", "gte", "lte"],
      wrap$k((lhs, op) => {
        return {
          type: "comparisonOpen",
          lhs: lhs.lhs,
          op,
          comparisons: lhs.comparisons,
        };
      })
    ),
  },
};

const { map: map$i } = beanParser;
const types$b = types$h;
const { expressions: expressions$8, wrap: wrap$j, values: values$b, ignore: ignore$6 } = common;

var logicals = {
  // Logical
  ...map$i([...values$b, ...expressions$8], {
    ...map$i(
      ["and", "or"],
      wrap$j((lhs, op) => {
        return {
          type: "logicalOpen",
          lhs: types$b.get(lhs),
          op,
          logicals: [],
        };
      }, 2)
    ),
  }),
  logicalOpen: {
    ...ignore$6("lineBreak"),
    ...map$i(
      [...values$b, ...expressions$8],
      wrap$j((lhs, rhs) => {
        return {
          type: "logical",
          lhs: lhs.lhs,
          logicals: [...lhs.logicals, { op: lhs.op, rhs: types$b.get(rhs) }],
        };
      }, 3)
    ),
  },
  logical: {
    ...ignore$6("lineBreak"),
    ...map$i(
      ["and", "or"],
      wrap$j((lhs, op) => {
        return {
          type: "logicalOpen",
          lhs: lhs.lhs,
          op,
          logicals: lhs.logicals,
        };
      })
    ),
  },
  not: {
    ...ignore$6("lineBreak"),
    ...map$i(
      [...values$b, ...expressions$8],
      wrap$j((op, rhs) => {
        return { type: "logicalNot", op, rhs: types$b.get(rhs) };
      }, 3.5)
    ),
  },
};

const { map: map$h } = beanParser;
const types$a = types$h;
const { expressions: expressions$7, wrap: wrap$i, values: values$a, ignore: ignore$5 } = common;

var conditionals = {
  // conditionals
  if: {
    ...map$h(
      expressions$7,
      wrap$i((lhs, rhs) => {
        return {
          type: "ifOpen",
          start: lhs,
          condition: types$a.get(rhs),
        };
      }, 0.05)
    ),
    ...map$h(
      values$a,
      wrap$i((lhs, rhs) => {
        return {
          type: "ifOpen",
          start: lhs,
          condition: types$a.get(rhs),
        };
      }, 0)
    ),
  },
  ifOpen: {
    colon: wrap$i((lhs) => {
      lhs.type = "ifTail";
      return lhs;
    }),
  },
  ifTail: {
    ...ignore$5("lineBreak"),
    block: wrap$i((lhs, rhs) => {
      return {
        type: "conditional",
        elseIfs: [],
        if: { ...lhs, type: "ifBlock", body: rhs },
      };
    }),
    ...map$h(
      [...expressions$7, ...values$a],
      wrap$i((lhs, rhs) => {
        const body = { type: "block", content: [rhs] };
        return {
          type: "conditional",
          elseIfs: [],
          if: { ...lhs, type: "ifBlock", body },
        };
      }, 0)
    ),
  },
  conditional: {
    lineBreak: wrap$i((lhs) => lhs, 100),
    else: wrap$i((lhs, rhs) => {
      return {
        type: "ifElseOpen",
        if: lhs.if,
        elseIfs: lhs.elseIfs,
        open: { start: rhs },
      };
    }),
  },
  ifElseOpen: {
    colon: wrap$i((lhs) => {
      lhs.type = "ifElseTail";
      return lhs;
    }),
    if: wrap$i((lhs, rhs) => {
      lhs.open.if = rhs;
      lhs.type = "ifElseIfNoCondition";
      return lhs;
    }),
  },
  ifElseIfNoCondition: {
    ...map$h(
      [...expressions$7, ...values$a],
      wrap$i((lhs, rhs) => {
        lhs.type = "ifElseIfOpen";
        lhs.open.condition = types$a.get(rhs);
        return lhs;
      }, 0)
    ),
  },
  ifElseIfOpen: {
    colon: wrap$i((lhs) => {
      lhs.type = "ifElseIfTail";
      return lhs;
    }),
  },
  ifElseIfTail: {
    ...ignore$5("lineBreak"),
    block: wrap$i((lhs, rhs) => {
      return {
        type: "conditional",
        if: lhs.if,
        elseIfs: [
          ...lhs.elseIfs,
          { ...lhs.open, type: "elseIfBlock", body: rhs },
        ],
        else: lhs.else,
      };
    }),
    ...map$h(
      [...expressions$7, ...values$a],
      wrap$i((lhs, rhs) => {
        const body = { type: "block", content: [rhs] };
        return {
          type: "conditional",
          if: lhs.if,
          elseIfs: [...lhs.elseIfs, { ...lhs.open, type: "elseIfBlock", body }],
          else: lhs.else,
        };
      }, 0)
    ),
  },
  ifElseTail: {
    ...ignore$5("lineBreak"),
    block: wrap$i((lhs, rhs) => {
      return {
        type: "fullConditional",
        if: lhs.if,
        elseIfs: [...lhs.elseIfs],
        else: { ...lhs.open, type: "elseBlock", body: rhs },
      };
    }),
    ...map$h(
      [...expressions$7, ...values$a],
      wrap$i((lhs, rhs) => {
        const body = { type: "block", content: [rhs] };
        return {
          type: "fullConditional",
          if: lhs.if,
          elseIfs: [...lhs.elseIfs],
          else: { ...lhs.open, type: "elseBlock", body },
        };
      }, 0)
    ),
  },
};

const { map: map$g } = beanParser;
const types$9 = types$h;
const { expressions: expressions$6, wrap: wrap$h, values: values$9, ignore: ignore$4 } = common;

var arrays = {
  // Arrays
  lSquare: {
    ...ignore$4("lineBreak"),
    ...map$g(
      [...values$9, ...expressions$6],
      wrap$h((lhs, rhs) => {
        return { type: "arrayOpen", start: lhs, items: [types$9.get(rhs)] };
      }, 4.1)
    ),
    rSquare: wrap$h((lhs, rhs) => {
      return { type: "array", start: lhs, end: rhs, items: [] };
    }),
  },
  arrayOpen: {
    ...ignore$4("lineBreak"),
    ...map$g(
      [...values$9, ...expressions$6],
      wrap$h((lhs, rhs) => {
        lhs.items.push(types$9.get(rhs));
        return lhs;
      }, 4.1)
    ),
    rSquare: wrap$h((lhs, rhs) => {
      lhs.type = "array";
      lhs.end = rhs;
      return lhs;
    }),
  },
};

const { map: map$f } = beanParser;
const { lPluck: lPluck$2 } = beanParser;
const types$8 = types$h;
const { wrap: wrap$g, values: values$8 } = common;

var hashmaps = {
  // Hashmaps
  hash: {
    symbol: wrap$g((lhs, rhs) => {
      return {
        type: "hashOpen",
        key: types$8.get(rhs),
        start: lhs,
        keyValues: [],
      };
    }, 4.1),
    indent: wrap$g((lhs) => {
      return {
        type: "hashmapIndent",
        start: lhs,
        keyValues: [],
        isTopLevel: true,
      };
    }),
    ender: wrap$g((lhs) => {
      return {
        type: "hashmap",
        start: lhs,
        keyValues: [],
      };
    }),
  },
  hashOpen: {
    colon: wrap$g((lhs) => {
      lhs.type = "hashOpenColon";
      return lhs;
    }, 4.1),
  },
  hashOpenColon: {
    ...map$f(
      values$8,
      wrap$g((lhs, rhs) => {
        lhs.type = "hashmap";
        lhs.keyValues.push(
          types$8.get({
            type: "keyValue",
            key: lhs.key,
            value: types$8.get(rhs),
          })
        );
        return lhs;
      }, 4.1)
    ),
    indent: wrap$g((lhs, rhs) => {
      return {
        type: "hashmapIndent",
        parent: lhs,
        keyValues: [],
        start: rhs,
      };
    }),
  },
  hashmap: {
    symbol: wrap$g((lhs, rhs) => {
      lhs.key = types$8.get(rhs);
      lhs.type = "hashOpen";
      return lhs;
    }, 4.1),
    indent: wrap$g((lhs) => {
      lhs.type = "hashmapIndent";
      lhs.isTopLevel = true;
      return lhs;
    }),
  },
  // Nested Hashmap
  hashIndentOpen: {
    colon: wrap$g((lhs) => {
      lhs.type = "hashIndentOpenColon";
      return lhs;
    }, 4.1),
  },
  hashIndentOpenColon: {
    ...map$f(["lineBreak"], wrap$g(lPluck$2, 3)),
    ...map$f(
      values$8,
      wrap$g((lhs, rhs) => {
        lhs.type = "hashmapIndent";
        lhs.keyValues.push(
          types$8.get({
            type: "keyValue",
            key: lhs.key,
            value: types$8.get(rhs),
          })
        );
        return lhs;
      }, 4.1)
    ),
    indent: wrap$g((lhs, rhs) => {
      return {
        type: "hashmapIndent",
        parent: lhs,
        start: rhs,
        keyValues: [],
      };
    }),
  },
  hashmapIndent: {
    ...map$f(["lineBreak"], wrap$g(lPluck$2, 3)),
    symbol: wrap$g((lhs, rhs) => {
      lhs.key = types$8.get(rhs);
      lhs.type = "hashIndentOpen";
      return lhs;
    }, 4.1),
    outdent: wrap$g((lhs) => {
      const { parent, isTopLevel } = lhs;
      if (isTopLevel) {
        lhs.type = "hashmap";
        return lhs;
      }
      lhs.type = "hashmap";
      parent.type =
        parent.type == "hashOpenColon" ? "hashmap" : "hashmapIndent";
      parent.keyValues.push(
        types$8.get({
          type: "keyValue",
          key: parent.key,
          value: types$8.get(lhs),
        })
      );
      return parent;
    }),
  },
};

const { map: map$e } = beanParser;
const { wrap: wrap$f } = common;

var properties = {
  // Property Access
  ...map$e(["symbol", "propertyAccess", "slice", "parameter"], {
    dot: wrap$f((lhs, dot) => {
      return { type: "propertyAccessOpen", lhs, dot };
    }, 912),
  }),
  propertyAccessOpen: {
    symbol: wrap$f((lhs, rhs) => {
      return { ...lhs, type: "propertyAccess", rhs };
    }, 913),
  },
};

const { map: map$d } = beanParser;
const { wrap: wrap$e } = common;

var methods = {
  // Method
  dot: {
    ...map$d(
      ["symbol", "propertyAccess", "slice"],
      wrap$e((dot, rhs) => {
        return { type: "method", dot, property: rhs };
      }, 11)
    ),
  },
};

const { map: map$c } = beanParser;
const types$7 = types$h;
const { wrap: wrap$d, ranges, values: values$7 } = common;

var ranges_1 = {
  // Range
  ranger: {
    ...map$c(
      values$7.filter((item) => !ranges.includes(item)),
      wrap$d((lhs, rhs) => {
        return { type: "range", location: lhs, end: types$7.get(rhs) };
      }, 43)
    ),
    by: wrap$d((lhs, rhs) => {
      return { location: lhs, step: rhs.step, type: "rangeByOpen" };
    }, 99),
  },
  ...map$c(
    values$7.filter((item) => !ranges.includes(item)),
    {
      ranger: wrap$d((lhs, rhs) => {
        return { type: "range", start: types$7.get(lhs), location: rhs };
      }, 99.9),
    }
  ),
  range: {
    ...map$c(
      values$7.filter((item) => !ranges.includes(item)),
      wrap$d((lhs, rhs) => {
        lhs.type = "rangeFull";
        lhs.end = types$7.get(rhs);
        return lhs;
      }, 45)
    ),
    by: wrap$d((lhs, rhs) => {
      return { ...lhs, step: rhs.step, type: "rangeByOpen" };
    }, 99),
  },
  rangeFull: {
    by: wrap$d((lhs, rhs) => {
      return { ...lhs, step: rhs.step, type: "rangeByOpen" };
    }, 99),
  },
  by: {
    ...map$c(
      values$7.filter((item) => !ranges.includes(item)),
      wrap$d((lhs, rhs) => {
        return { type: "byRange", step: types$7.get(rhs), location: lhs };
      }, 47)
    ),
  },
  rangeByOpen: {
    ...map$c(
      values$7.filter((item) => !ranges.includes(item)),
      wrap$d((lhs, rhs) => {
        return { ...lhs, type: "byRange", step: types$7.get(rhs), location: lhs };
      }, 47)
    ),
  },
};

const { map: map$b } = beanParser;
const types$6 = types$h;
const { arrayLike, wrap: wrap$c } = common;

var slices = {
  // Slice
  sliceOpen: {
    array: wrap$c((lhs, rhs) => {
      lhs.type = "slice";
      lhs.slicer = types$6.get(rhs);
      return lhs;
    }, 100),
  },
  ...map$b(arrayLike, {
    slicer: wrap$c((lhs) => {
      return {
        type: "sliceOpen",
        slicee: types$6.get(lhs),
      };
    }, 99),
  }),
};

const { map: map$a } = beanParser;
const types$5 = types$h;
const { expressions: expressions$5, wrap: wrap$b, values: values$6, ignore: ignore$3 } = common;

var sets = {
  // Sets
  lCurly: {
    ...ignore$3("lineBreak"),
    ...map$a(
      [...values$6, ...expressions$5],
      wrap$b((lhs, rhs) => {
        return { type: "setOpen", start: lhs, items: [types$5.get(rhs)] };
      })
    ),
    rCurly: wrap$b((lhs, rhs) => {
      return { type: "set", start: lhs, end: rhs, items: [] };
    }),
  },
  setOpen: {
    ...ignore$3("lineBreak"),
    ...map$a(
      [...values$6, ...expressions$5],
      wrap$b((lhs, rhs) => {
        lhs.items.push(types$5.get(rhs));
        return lhs;
      })
    ),
    rCurly: wrap$b((lhs, rhs) => {
      lhs.type = "set";
      lhs.end = rhs;
      return lhs;
    }),
  },
};

const { rule: rule$2, map: map$9 } = beanParser;
const { lPluck: lPluck$1 } = beanParser;
const { expressions: expressions$4, wrap: wrap$a, values: values$5, ignore: ignore$2 } = common;

var wrapped = {
  // Wrapped
  lParen: {
    ...map$9(["lineBreak"], rule$2(lPluck$1, 10)),
    ...map$9(
      [...values$5, ...expressions$4],
      wrap$a((lhs, rhs) => {
        return { type: "wrappedOpen", start: lhs, content: rhs };
      }, 0.1)
    ),
    rParen: wrap$a(() => {
      return { type: "wrapped", content: null };
    }),
    ender: wrap$a((lhs) => lhs, 100),
  },
  wrappedOpen: {
    ...ignore$2("lineBreak"),
    rParen: wrap$a((lhs, rhs) => {
      lhs.type = "wrapped";
      lhs.end = rhs;
      return lhs;
    }),
  },
};

const { rule: rule$1, map: map$8 } = beanParser;
const { lPluck } = beanParser;
const types$4 = types$h;
const { expressions: expressions$3, wrap: wrap$9, values: values$4, ignore: ignore$1 } = common;

var formattedStrings = {
  // Formatted Strings
  ...map$8(["symbol", "propertyAccess", "slice"], {
    format: wrap$9((lhs) => {
      return { type: "fmtStrFn", fn: lhs, args: [] };
    }, 99),
  }),
  fmtStrFn: {
    fmtStart: wrap$9((lhs) => {
      lhs.type = "fmtOpen";
      return lhs;
    }, 99),
  },
  fmtOpen: {
    ...map$8(
      ["fmtExpr", "strEscape", "fmtStr"],
      wrap$9((lhs, rhs) => {
        lhs.args.push(rhs);
        return lhs;
      }, 99)
    ),
    fmtEnd: wrap$9((lhs) => {
      lhs.type = "formattedString";
      return lhs;
    }),
  },
  // fmtExpr
  fmtExprStart: {
    ...map$8(["lineBreak"], rule$1(lPluck, 10)),
    ...map$8(
      [...values$4, ...expressions$3],
      wrap$9((lhs, rhs) => {
        return { type: "fmtExprOpen", start: lhs, content: types$4.get(rhs) };
      }, 0.11)
    ),
    fmtExprEnd: wrap$9(() => {
      return { type: "fmtExpr", content: null };
    }),
    ender: wrap$9((lhs) => lhs, 100),
  },
  fmtExprOpen: {
    ...ignore$1("lineBreak"),
    fmtExprEnd: wrap$9((lhs, rhs) => {
      lhs.type = "fmtExpr";
      lhs.end = rhs;
      return lhs;
    }),
  },
};

const { map: map$7 } = beanParser;
const types$3 = types$h;
const { expressions: expressions$2, wrap: wrap$8, values: values$3 } = common;

var assignments = {
  // Assignment
  ...map$7(["symbol", "propertyAccess", "slice"], {
    assign: wrap$8((lhs, rhs) => {
      return { type: "assignOpen", name: lhs, assign: rhs };
    }),
  }),
  assignOpen: {
    ...map$7(
      [...values$3, ...expressions$2],
      wrap$8((lhs, rhs) => {
        lhs.type = "assignment";
        lhs.value = types$3.get(rhs);
        return lhs;
      }, 0.001)
    ),
  },
};

const { rule, map: map$6 } = beanParser;
const types$2 = types$h;
const { expressions: expressions$1, wrap: wrap$7, values: values$2, ignore } = common;

var fatAssignments = {
  // Fat arrow assignment
  ...map$6([...values$2, ...expressions$1], {
    ender: rule((lhs) => lhs, 0.5),
    fatArrow: wrap$7((lhs, rhs) => {
      return {
        type: "fatArrowOpen",
        arrow: rhs,
        value: types$2.get(lhs),
      };
    }, 0.31),
  }),
  fatArrowOpen: {
    ...map$6(
      ["symbol", "propertyAccess", "slice"],
      wrap$7((lhs, rhs) => {
        lhs.type = "arrowAssignment";
        lhs.name = rhs;
        return lhs;
      }, 0.31)
    ),
  },
  arrowAssignment: {
    ...ignore("lineBreak"),
    arrow: wrap$7((lhs) => {
      return {
        type: "pipeOpen",
        data: lhs,
      };
    }),
    ender: wrap$7((lhs) => lhs),
  },
};

const { map: map$5 } = beanParser;
const { wrap: wrap$6, values: values$1 } = common;

var _await = {
  // Await
  await: {
    ...map$5(
      [...values$1, "call", "parallelFn", "method"],
      wrap$6((lhs, rhs) => {
        return { type: "awaited", await: lhs, value: rhs };
      }, 0.4)
    ),
  },
  awaitAll: {
    ...map$5(
      [...values$1, "call", "parallelFn", "method"],
      wrap$6((lhs, rhs) => {
        return {
          type: "awaited",
          all: true,
          await: lhs,
          value: rhs,
        };
      }, 0.4)
    ),
  },
};

const { wrap: wrap$5 } = common;

var exports = {
  // Export
  export: {
    function: wrap$5((lhs, rhs) => {
      return {
        type: "exportedFunction",
        name: rhs.name,
        value: rhs,
        export: lhs,
      };
    }),
    assignment: wrap$5((lhs, rhs) => {
      return {
        type: "exported",
        name: rhs.name,
        value: rhs,
        export: lhs,
      };
    }),
  },
};

const { map: map$4 } = beanParser;
const { wrap: wrap$4 } = common;

var imports = {
  // Import
  import: {
    ...map$4(
      ["asClause", "symbol"],
      wrap$4((lhs, rhs) => {
        return { type: "importOpen", items: [rhs], import: lhs };
      }, 17)
    ),
    string: wrap$4((lhs, rhs) => {
      return { type: "imported", import: lhs, path: rhs };
    }),
  },
  importOpen: {
    ...map$4(
      ["asClause", "symbol"],
      wrap$4((lhs, rhs) => {
        lhs.items.push(rhs);
        return lhs;
      }, 18)
    ),
    from: wrap$4((lhs, rhs) => {
      lhs.from = rhs;
      lhs.type = "importFromOpen";
      return lhs;
    }),
  },
  importFromOpen: {
    string: wrap$4((lhs, rhs) => {
      lhs.path = rhs;
      lhs.type = "imported";
      return lhs;
    }),
  },
  ...map$4(["symbol", "mulOp"], {
    as: wrap$4((lhs, rhs) => {
      return { type: "asOpen", lhs, as: rhs };
    }, 32),
  }),
  asOpen: {
    symbol: wrap$4((lhs, rhs) => {
      lhs.rhs = rhs;
      lhs.type = "asClause";
      return lhs;
    }, 33),
  },
};

const { map: map$3 } = beanParser;
const { expressions, wrap: wrap$3, values } = common;

var _in = {
  // In check
  ...map$3([...expressions, ...values], {
    in: wrap$3((lhs, rhs) => {
      return { type: "inCheckOpen", lhs: lhs, start: rhs };
    }, 0.1),
  }),
  inCheckOpen: {
    ...map$3(
      [...expressions, ...values],
      wrap$3((lhs, rhs) => {
        lhs.type = "inCheck";
        lhs.rhs = rhs;
        return lhs;
      })
    ),
  },
};

const { map: map$2 } = beanParser;
const types$1 = types$h;
const { topLevels, wrap: wrap$2 } = common;

var clio = {
  // Top level rule
  ...map$2([...topLevels, "exported", "exportedFunction"], {
    eof: wrap$2((lhs) => {
      return { type: "clio", content: [types$1.get(lhs)] };
    }, 0),
    clio: wrap$2((lhs, rhs) => {
      rhs.content.unshift(types$1.get(lhs));
      return rhs;
    }, 0),
  }),
  lineBreak: {
    clio: wrap$2((_, rhs) => rhs, 0),
    eof: wrap$2(() => {
      return { type: "clio", content: [] };
    }),
  },
};

const { map: map$1, merge: merge$2 } = beanParser;
const { wrap: wrap$1 } = common;

var boosters = merge$2(
  {
    ...map$1(
      ["symbol", "propertyAccess", "wrapped", "slice", "range", "parallelFn"],
      {
        ...map$1(
          ["groupStart"],
          wrap$1(
            /* istanbul ignore next */
            () => {
              /* This never matches, but boosts wrapped, array,
             hashmap, set vs block rule matching */
            },
            0.5
          )
        ),
      }
    ),
  },
  {
    ...map$1(["symbol", "propertyAccess", "wrapped", "slice", "parallelFn"], {
      ...map$1(
        ["hash"],
        wrap$1(
          /* istanbul ignore next */
          () => {
            /* This never matches, but boosts wrapped, array,
             hashmap, set vs block rule matching */
          },
          0.05
        )
      ),
    }),
  }
);

const { map, bean: bean$1, merge: merge$1, list } = beanParser;
const { wrap, lexerTokens } = common;

const rules$3 = merge$1(
  calls,
  blocks,
  parallelFns,
  functions,
  math,
  comparisons,
  logicals,
  conditionals,
  arrays,
  hashmaps,
  properties,
  methods,
  ranges_1,
  slices,
  sets,
  wrapped,
  formattedStrings,
  assignments,
  fatAssignments,
  _await,
  exports,
  imports,
  _in,
  clio,
  boosters
);

var groups = {
  // Group
  groupStart: {
    ...map(
      lexerTokens,
      wrap((_, rhs) => {
        return { type: "groupOpen", content: list([rhs]), open: 1 };
      }, 9999)
    ),
  },
  groupOpen: {
    ...map(
      lexerTokens,
      wrap((lhs, rhs) => {
        lhs.content.push(rhs);
        return lhs;
      }, 9999)
    ),
    groupStart: wrap((lhs) => {
      lhs.open++;
      return lhs;
    }, 9999),
    groupEnd: wrap((lhs) => {
      lhs.open--;
      // FIXME: We need error checking here
      return lhs.open ? lhs : bean$1(lhs.content, rules$3, true).first.item;
    }, 9999),
  },
};

const { merge } = beanParser;

const rules$2 = merge(
  groups,
  calls,
  blocks,
  parallelFns,
  functions,
  math,
  comparisons,
  logicals,
  conditionals,
  arrays,
  hashmaps,
  properties,
  methods,
  ranges_1,
  slices,
  sets,
  wrapped,
  formattedStrings,
  assignments,
  fatAssignments,
  _await,
  exports,
  imports,
  _in,
  clio,
  boosters
);

var rules_1 = rules$2;

var errors = {};

const rules$1 = rules_1;

/* istanbul ignore next */
const opens = [
  "blockOpen",
  "addLhs",
  "mulLhs",
  "subLhs",
  "divLhs",
  "powLhs",
  "comparisonOpen",
  "logicalOpen",
  "export",
  "fnTail",
];
/* istanbul ignore next */
const whites = ["lineBreak", "indent", "outdent"];

const getMessage = (file, line, start, column, source, expecting, rhs) => {
  const code = source.split("\n").slice(start, line).join("\n");
  return [
    `Parsing error at ${file}[${line}:${column}]\n`,
    code,
    " ".repeat(column) + "^",
    `\nExpecting one of ${expecting} but encountered ${rhs.item.type}`,
  ].join("\n");
};

/* istanbul ignore next */
const parsingError$1 = (source, file, tokens) => {
  let lhs = tokens.first;
  let rhs = tokens.first.next;
  const step = () => {
    lhs = rhs;
    rhs = lhs.next;
  };
  while (true) {
    if (opens.includes(rhs.item.type)) step();
    else if (whites.includes(lhs.item.type)) step();
    else if (whites.includes(rhs.item.type)) step();
    else break;
  }
  if (rhs.item.type == "clio") rhs = { item: rhs.item.content[0]?.node };
  const expecting = Object.keys(rules$1[lhs.item.type] || {}).join(", ");
  const start = Math.max(0, rhs.item.line - 3);
  const location = rhs.item.meta?.location || rhs.item;
  const { line, column } = location;
  const message = getMessage(file, line, start, column, source, expecting, rhs);
  return new Error(message);
};

errors.parsingError = parsingError$1;

const { bean } = beanParser;
const lex = lexer;
const types = types$h;
const rules = rules_1;
const { parsingError } = errors;

const parse = (tokens) => bean(tokens, rules);
const compile = (source, file, debug = false) => {
  const tokens = lex(source, file);
  /* istanbul ignore next */
  if (debug) console.dir(tokens.current, { depth: null });
  const result = parse(tokens);
  /* istanbul ignore next */
  if (debug) console.dir(result, { depth: null });
  /* istanbul ignore next */
  if (result.first.item.type == "clio") {
    const { code, map } = types
      .get(result.current.item)
      .toStringWithSourceMap();
    map.setSourceContent(file, source);
    return {
      code: code + `//# sourceMappingURL=${file}.js.map`,
      map: map.toString(),
    };
    /* istanbul ignore next */
  } else {
    /* istanbul ignore next */
    throw parsingError(source, file, result);
  }
};
var compile_1 = compile;

var _nodeResolve_empty = {};

var _nodeResolve_empty$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  'default': _nodeResolve_empty
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(_nodeResolve_empty$1);

var hasMap = typeof Map === 'function' && Map.prototype;
var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, 'size') : null;
var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === 'function' ? mapSizeDescriptor.get : null;
var mapForEach = hasMap && Map.prototype.forEach;
var hasSet = typeof Set === 'function' && Set.prototype;
var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, 'size') : null;
var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === 'function' ? setSizeDescriptor.get : null;
var setForEach = hasSet && Set.prototype.forEach;
var hasWeakMap = typeof WeakMap === 'function' && WeakMap.prototype;
var weakMapHas = hasWeakMap ? WeakMap.prototype.has : null;
var hasWeakSet = typeof WeakSet === 'function' && WeakSet.prototype;
var weakSetHas = hasWeakSet ? WeakSet.prototype.has : null;
var hasWeakRef = typeof WeakRef === 'function' && WeakRef.prototype;
var weakRefDeref = hasWeakRef ? WeakRef.prototype.deref : null;
var booleanValueOf = Boolean.prototype.valueOf;
var objectToString = Object.prototype.toString;
var functionToString = Function.prototype.toString;
var match = String.prototype.match;
var bigIntValueOf = typeof BigInt === 'function' ? BigInt.prototype.valueOf : null;
var gOPS = Object.getOwnPropertySymbols;
var symToString = typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol' ? Symbol.prototype.toString : null;
var hasShammedSymbols = typeof Symbol === 'function' && typeof Symbol.iterator === 'object';
var isEnumerable = Object.prototype.propertyIsEnumerable;

var gPO = (typeof Reflect === 'function' ? Reflect.getPrototypeOf : Object.getPrototypeOf) || (
    [].__proto__ === Array.prototype // eslint-disable-line no-proto
        ? function (O) {
            return O.__proto__; // eslint-disable-line no-proto
        }
        : null
);

var inspectCustom = require$$0.custom;
var inspectSymbol = inspectCustom && isSymbol(inspectCustom) ? inspectCustom : null;
var toStringTag = typeof Symbol === 'function' && typeof Symbol.toStringTag !== 'undefined' ? Symbol.toStringTag : null;

var objectInspect = function inspect_(obj, options, depth, seen) {
    var opts = options || {};

    if (has(opts, 'quoteStyle') && (opts.quoteStyle !== 'single' && opts.quoteStyle !== 'double')) {
        throw new TypeError('option "quoteStyle" must be "single" or "double"');
    }
    if (
        has(opts, 'maxStringLength') && (typeof opts.maxStringLength === 'number'
            ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity
            : opts.maxStringLength !== null
        )
    ) {
        throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
    }
    var customInspect = has(opts, 'customInspect') ? opts.customInspect : true;
    if (typeof customInspect !== 'boolean') {
        throw new TypeError('option "customInspect", if provided, must be `true` or `false`');
    }

    if (
        has(opts, 'indent')
        && opts.indent !== null
        && opts.indent !== '\t'
        && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)
    ) {
        throw new TypeError('options "indent" must be "\\t", an integer > 0, or `null`');
    }

    if (typeof obj === 'undefined') {
        return 'undefined';
    }
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'boolean') {
        return obj ? 'true' : 'false';
    }

    if (typeof obj === 'string') {
        return inspectString(obj, opts);
    }
    if (typeof obj === 'number') {
        if (obj === 0) {
            return Infinity / obj > 0 ? '0' : '-0';
        }
        return String(obj);
    }
    if (typeof obj === 'bigint') {
        return String(obj) + 'n';
    }

    var maxDepth = typeof opts.depth === 'undefined' ? 5 : opts.depth;
    if (typeof depth === 'undefined') { depth = 0; }
    if (depth >= maxDepth && maxDepth > 0 && typeof obj === 'object') {
        return isArray(obj) ? '[Array]' : '[Object]';
    }

    var indent = getIndent(opts, depth);

    if (typeof seen === 'undefined') {
        seen = [];
    } else if (indexOf(seen, obj) >= 0) {
        return '[Circular]';
    }

    function inspect(value, from, noIndent) {
        if (from) {
            seen = seen.slice();
            seen.push(from);
        }
        if (noIndent) {
            var newOpts = {
                depth: opts.depth
            };
            if (has(opts, 'quoteStyle')) {
                newOpts.quoteStyle = opts.quoteStyle;
            }
            return inspect_(value, newOpts, depth + 1, seen);
        }
        return inspect_(value, opts, depth + 1, seen);
    }

    if (typeof obj === 'function') {
        var name = nameOf(obj);
        var keys = arrObjKeys(obj, inspect);
        return '[Function' + (name ? ': ' + name : ' (anonymous)') + ']' + (keys.length > 0 ? ' { ' + keys.join(', ') + ' }' : '');
    }
    if (isSymbol(obj)) {
        var symString = hasShammedSymbols ? String(obj).replace(/^(Symbol\(.*\))_[^)]*$/, '$1') : symToString.call(obj);
        return typeof obj === 'object' && !hasShammedSymbols ? markBoxed(symString) : symString;
    }
    if (isElement(obj)) {
        var s = '<' + String(obj.nodeName).toLowerCase();
        var attrs = obj.attributes || [];
        for (var i = 0; i < attrs.length; i++) {
            s += ' ' + attrs[i].name + '=' + wrapQuotes(quote(attrs[i].value), 'double', opts);
        }
        s += '>';
        if (obj.childNodes && obj.childNodes.length) { s += '...'; }
        s += '</' + String(obj.nodeName).toLowerCase() + '>';
        return s;
    }
    if (isArray(obj)) {
        if (obj.length === 0) { return '[]'; }
        var xs = arrObjKeys(obj, inspect);
        if (indent && !singleLineValues(xs)) {
            return '[' + indentedJoin(xs, indent) + ']';
        }
        return '[ ' + xs.join(', ') + ' ]';
    }
    if (isError(obj)) {
        var parts = arrObjKeys(obj, inspect);
        if (parts.length === 0) { return '[' + String(obj) + ']'; }
        return '{ [' + String(obj) + '] ' + parts.join(', ') + ' }';
    }
    if (typeof obj === 'object' && customInspect) {
        if (inspectSymbol && typeof obj[inspectSymbol] === 'function') {
            return obj[inspectSymbol]();
        } else if (typeof obj.inspect === 'function') {
            return obj.inspect();
        }
    }
    if (isMap(obj)) {
        var mapParts = [];
        mapForEach.call(obj, function (value, key) {
            mapParts.push(inspect(key, obj, true) + ' => ' + inspect(value, obj));
        });
        return collectionOf('Map', mapSize.call(obj), mapParts, indent);
    }
    if (isSet(obj)) {
        var setParts = [];
        setForEach.call(obj, function (value) {
            setParts.push(inspect(value, obj));
        });
        return collectionOf('Set', setSize.call(obj), setParts, indent);
    }
    if (isWeakMap(obj)) {
        return weakCollectionOf('WeakMap');
    }
    if (isWeakSet(obj)) {
        return weakCollectionOf('WeakSet');
    }
    if (isWeakRef(obj)) {
        return weakCollectionOf('WeakRef');
    }
    if (isNumber(obj)) {
        return markBoxed(inspect(Number(obj)));
    }
    if (isBigInt(obj)) {
        return markBoxed(inspect(bigIntValueOf.call(obj)));
    }
    if (isBoolean(obj)) {
        return markBoxed(booleanValueOf.call(obj));
    }
    if (isString(obj)) {
        return markBoxed(inspect(String(obj)));
    }
    if (!isDate(obj) && !isRegExp(obj)) {
        var ys = arrObjKeys(obj, inspect);
        var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
        var protoTag = obj instanceof Object ? '' : 'null prototype';
        var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? toStr(obj).slice(8, -1) : protoTag ? 'Object' : '';
        var constructorTag = isPlainObject || typeof obj.constructor !== 'function' ? '' : obj.constructor.name ? obj.constructor.name + ' ' : '';
        var tag = constructorTag + (stringTag || protoTag ? '[' + [].concat(stringTag || [], protoTag || []).join(': ') + '] ' : '');
        if (ys.length === 0) { return tag + '{}'; }
        if (indent) {
            return tag + '{' + indentedJoin(ys, indent) + '}';
        }
        return tag + '{ ' + ys.join(', ') + ' }';
    }
    return String(obj);
};

function wrapQuotes(s, defaultStyle, opts) {
    var quoteChar = (opts.quoteStyle || defaultStyle) === 'double' ? '"' : "'";
    return quoteChar + s + quoteChar;
}

function quote(s) {
    return String(s).replace(/"/g, '&quot;');
}

function isArray(obj) { return toStr(obj) === '[object Array]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
function isDate(obj) { return toStr(obj) === '[object Date]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
function isRegExp(obj) { return toStr(obj) === '[object RegExp]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
function isError(obj) { return toStr(obj) === '[object Error]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
function isString(obj) { return toStr(obj) === '[object String]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
function isNumber(obj) { return toStr(obj) === '[object Number]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
function isBoolean(obj) { return toStr(obj) === '[object Boolean]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }

// Symbol and BigInt do have Symbol.toStringTag by spec, so that can't be used to eliminate false positives
function isSymbol(obj) {
    if (hasShammedSymbols) {
        return obj && typeof obj === 'object' && obj instanceof Symbol;
    }
    if (typeof obj === 'symbol') {
        return true;
    }
    if (!obj || typeof obj !== 'object' || !symToString) {
        return false;
    }
    try {
        symToString.call(obj);
        return true;
    } catch (e) {}
    return false;
}

function isBigInt(obj) {
    if (!obj || typeof obj !== 'object' || !bigIntValueOf) {
        return false;
    }
    try {
        bigIntValueOf.call(obj);
        return true;
    } catch (e) {}
    return false;
}

var hasOwn = Object.prototype.hasOwnProperty || function (key) { return key in this; };
function has(obj, key) {
    return hasOwn.call(obj, key);
}

function toStr(obj) {
    return objectToString.call(obj);
}

function nameOf(f) {
    if (f.name) { return f.name; }
    var m = match.call(functionToString.call(f), /^function\s*([\w$]+)/);
    if (m) { return m[1]; }
    return null;
}

function indexOf(xs, x) {
    if (xs.indexOf) { return xs.indexOf(x); }
    for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) { return i; }
    }
    return -1;
}

function isMap(x) {
    if (!mapSize || !x || typeof x !== 'object') {
        return false;
    }
    try {
        mapSize.call(x);
        try {
            setSize.call(x);
        } catch (s) {
            return true;
        }
        return x instanceof Map; // core-js workaround, pre-v2.5.0
    } catch (e) {}
    return false;
}

function isWeakMap(x) {
    if (!weakMapHas || !x || typeof x !== 'object') {
        return false;
    }
    try {
        weakMapHas.call(x, weakMapHas);
        try {
            weakSetHas.call(x, weakSetHas);
        } catch (s) {
            return true;
        }
        return x instanceof WeakMap; // core-js workaround, pre-v2.5.0
    } catch (e) {}
    return false;
}

function isWeakRef(x) {
    if (!weakRefDeref || !x || typeof x !== 'object') {
        return false;
    }
    try {
        weakRefDeref.call(x);
        return true;
    } catch (e) {}
    return false;
}

function isSet(x) {
    if (!setSize || !x || typeof x !== 'object') {
        return false;
    }
    try {
        setSize.call(x);
        try {
            mapSize.call(x);
        } catch (m) {
            return true;
        }
        return x instanceof Set; // core-js workaround, pre-v2.5.0
    } catch (e) {}
    return false;
}

function isWeakSet(x) {
    if (!weakSetHas || !x || typeof x !== 'object') {
        return false;
    }
    try {
        weakSetHas.call(x, weakSetHas);
        try {
            weakMapHas.call(x, weakMapHas);
        } catch (s) {
            return true;
        }
        return x instanceof WeakSet; // core-js workaround, pre-v2.5.0
    } catch (e) {}
    return false;
}

function isElement(x) {
    if (!x || typeof x !== 'object') { return false; }
    if (typeof HTMLElement !== 'undefined' && x instanceof HTMLElement) {
        return true;
    }
    return typeof x.nodeName === 'string' && typeof x.getAttribute === 'function';
}

function inspectString(str, opts) {
    if (str.length > opts.maxStringLength) {
        var remaining = str.length - opts.maxStringLength;
        var trailer = '... ' + remaining + ' more character' + (remaining > 1 ? 's' : '');
        return inspectString(str.slice(0, opts.maxStringLength), opts) + trailer;
    }
    // eslint-disable-next-line no-control-regex
    var s = str.replace(/(['\\])/g, '\\$1').replace(/[\x00-\x1f]/g, lowbyte);
    return wrapQuotes(s, 'single', opts);
}

function lowbyte(c) {
    var n = c.charCodeAt(0);
    var x = {
        8: 'b',
        9: 't',
        10: 'n',
        12: 'f',
        13: 'r'
    }[n];
    if (x) { return '\\' + x; }
    return '\\x' + (n < 0x10 ? '0' : '') + n.toString(16).toUpperCase();
}

function markBoxed(str) {
    return 'Object(' + str + ')';
}

function weakCollectionOf(type) {
    return type + ' { ? }';
}

function collectionOf(type, size, entries, indent) {
    var joinedEntries = indent ? indentedJoin(entries, indent) : entries.join(', ');
    return type + ' (' + size + ') {' + joinedEntries + '}';
}

function singleLineValues(xs) {
    for (var i = 0; i < xs.length; i++) {
        if (indexOf(xs[i], '\n') >= 0) {
            return false;
        }
    }
    return true;
}

function getIndent(opts, depth) {
    var baseIndent;
    if (opts.indent === '\t') {
        baseIndent = '\t';
    } else if (typeof opts.indent === 'number' && opts.indent > 0) {
        baseIndent = Array(opts.indent + 1).join(' ');
    } else {
        return null;
    }
    return {
        base: baseIndent,
        prev: Array(depth + 1).join(baseIndent)
    };
}

function indentedJoin(xs, indent) {
    if (xs.length === 0) { return ''; }
    var lineJoiner = '\n' + indent.prev + indent.base;
    return lineJoiner + xs.join(',' + lineJoiner) + '\n' + indent.prev;
}

function arrObjKeys(obj, inspect) {
    var isArr = isArray(obj);
    var xs = [];
    if (isArr) {
        xs.length = obj.length;
        for (var i = 0; i < obj.length; i++) {
            xs[i] = has(obj, i) ? inspect(obj[i], obj) : '';
        }
    }
    var syms = typeof gOPS === 'function' ? gOPS(obj) : [];
    var symMap;
    if (hasShammedSymbols) {
        symMap = {};
        for (var k = 0; k < syms.length; k++) {
            symMap['$' + syms[k]] = syms[k];
        }
    }

    for (var key in obj) { // eslint-disable-line no-restricted-syntax
        if (!has(obj, key)) { continue; } // eslint-disable-line no-restricted-syntax, no-continue
        if (isArr && String(Number(key)) === key && key < obj.length) { continue; } // eslint-disable-line no-restricted-syntax, no-continue
        if (hasShammedSymbols && symMap['$' + key] instanceof Symbol) {
            // this is to prevent shammed Symbols, which are stored as strings, from being included in the string key section
            continue; // eslint-disable-line no-restricted-syntax, no-continue
        } else if ((/[^\w$]/).test(key)) {
            xs.push(inspect(key, obj) + ': ' + inspect(obj[key], obj));
        } else {
            xs.push(key + ': ' + inspect(obj[key], obj));
        }
    }
    if (typeof gOPS === 'function') {
        for (var j = 0; j < syms.length; j++) {
            if (isEnumerable.call(obj, syms[j])) {
                xs.push('[' + inspect(syms[j]) + ']: ' + inspect(obj[syms[j]], obj));
            }
        }
    }
    return xs;
}

/* ../playground/src/components/Editor.svelte generated by Svelte v3.38.2 */

const { console: console_1 } = globals;
const file$g = "../playground/src/components/Editor.svelte";

// (194:4) {#if examples}
function create_if_block_1$1(ctx) {
	let select;
	let option0;
	let option1;
	let option2;
	let option3;
	let option4;
	let option5;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			select = element("select");
			option0 = element("option");
			option0.textContent = "Parallel Fib";
			option1 = element("option");
			option1.textContent = "Parallel Fib (Alternate) ";
			option2 = element("option");
			option2.textContent = "Fib";
			option3 = element("option");
			option3.textContent = "Filter";
			option4 = element("option");
			option4.textContent = "Reduce";
			option5 = element("option");
			option5.textContent = "Express";
			option0.selected = true;
			option0.__value = "parallelFib";
			option0.value = option0.__value;
			add_location(option0, file$g, 195, 8, 5143);
			option1.__value = "parallelFibAlternate";
			option1.value = option1.__value;
			add_location(option1, file$g, 196, 8, 5210);
			option2.__value = "fib";
			option2.value = option2.__value;
			add_location(option2, file$g, 197, 8, 5291);
			option3.__value = "filter";
			option3.value = option3.__value;
			add_location(option3, file$g, 198, 8, 5332);
			option4.__value = "reduce";
			option4.value = option4.__value;
			add_location(option4, file$g, 199, 8, 5379);
			option5.__value = "express";
			option5.value = option5.__value;
			add_location(option5, file$g, 200, 8, 5426);
			attr_dev(select, "class", "sample svelte-1u6d8cy");
			add_location(select, file$g, 194, 6, 5085);
		},
		m: function mount(target, anchor) {
			insert_dev(target, select, anchor);
			append_dev(select, option0);
			append_dev(select, option1);
			append_dev(select, option2);
			append_dev(select, option3);
			append_dev(select, option4);
			append_dev(select, option5);

			if (!mounted) {
				dispose = listen_dev(select, "change", /*setSampleCode*/ ctx[5], false, false, false);
				mounted = true;
			}
		},
		p: noop$1,
		d: function destroy(detaching) {
			if (detaching) detach_dev(select);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1$1.name,
		type: "if",
		source: "(194:4) {#if examples}",
		ctx
	});

	return block;
}

// (204:4) {#if share}
function create_if_block$3(ctx) {
	let a;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			a = element("a");
			a.textContent = "Share";
			attr_dev(a, "href", "#?");
			attr_dev(a, "class", "btn share svelte-1u6d8cy");
			add_location(a, file$g, 204, 6, 5515);
		},
		m: function mount(target, anchor) {
			insert_dev(target, a, anchor);

			if (!mounted) {
				dispose = listen_dev(a, "click", /*copyShareURL*/ ctx[6], false, false, false);
				mounted = true;
			}
		},
		p: noop$1,
		d: function destroy(detaching) {
			if (detaching) detach_dev(a);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$3.name,
		type: "if",
		source: "(204:4) {#if share}",
		ctx
	});

	return block;
}

function create_fragment$h(ctx) {
	let div7;
	let div1;
	let img;
	let img_src_value;
	let t0;
	let span;
	let t1;
	let t2;
	let div0;
	let t3;
	let t4;
	let t5;
	let a;
	let t7;
	let div2;
	let t8;
	let div5;
	let div3;
	let t9;
	let div4;
	let div5_class_value;
	let t10;
	let div6;
	let mounted;
	let dispose;
	let if_block0 = /*examples*/ ctx[2] && create_if_block_1$1(ctx);
	let if_block1 = /*share*/ ctx[1] && create_if_block$3(ctx);

	const block = {
		c: function create() {
			div7 = element("div");
			div1 = element("div");
			img = element("img");
			t0 = space();
			span = element("span");
			t1 = text(/*title*/ ctx[0]);
			t2 = space();
			div0 = element("div");
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			a = element("a");
			a.textContent = "Run";
			t7 = space();
			div2 = element("div");
			t8 = space();
			div5 = element("div");
			div3 = element("div");
			t9 = space();
			div4 = element("div");
			t10 = space();
			div6 = element("div");
			div6.textContent = "Link copied to clipboard";
			if (img.src !== (img_src_value = "/logo-128x128.png")) attr_dev(img, "src", img_src_value);
			attr_dev(img, "class", "logo svelte-1u6d8cy");
			attr_dev(img, "alt", "logo");
			add_location(img, file$g, 190, 4, 4938);
			attr_dev(span, "class", "title");
			add_location(span, file$g, 191, 4, 4998);
			attr_dev(div0, "class", "spacer svelte-1u6d8cy");
			add_location(div0, file$g, 192, 4, 5037);
			attr_dev(a, "href", "#?");
			attr_dev(a, "class", "btn svelte-1u6d8cy");
			add_location(a, file$g, 206, 4, 5596);
			attr_dev(div1, "class", "toolbar svelte-1u6d8cy");
			add_location(div1, file$g, 189, 2, 4912);
			attr_dev(div2, "class", "sep svelte-1u6d8cy");
			add_location(div2, file$g, 208, 2, 5667);
			attr_dev(div3, "id", "clio-pane");
			attr_dev(div3, "class", "svelte-1u6d8cy");
			add_location(div3, file$g, 210, 4, 5749);
			attr_dev(div4, "id", "console-pane");
			attr_dev(div4, "class", "svelte-1u6d8cy");
			add_location(div4, file$g, 211, 4, 5776);
			attr_dev(div5, "class", div5_class_value = "editor " + (/*isHorizontal*/ ctx[3] ? "horizontal" : "") + " svelte-1u6d8cy");
			add_location(div5, file$g, 209, 2, 5689);
			attr_dev(div6, "class", "copied svelte-1u6d8cy");
			toggle_class(div6, "isActive", /*isActive*/ ctx[4]);
			add_location(div6, file$g, 213, 2, 5813);
			attr_dev(div7, "class", "container svelte-1u6d8cy");
			add_location(div7, file$g, 188, 0, 4886);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div7, anchor);
			append_dev(div7, div1);
			append_dev(div1, img);
			append_dev(div1, t0);
			append_dev(div1, span);
			append_dev(span, t1);
			append_dev(div1, t2);
			append_dev(div1, div0);
			append_dev(div1, t3);
			if (if_block0) if_block0.m(div1, null);
			append_dev(div1, t4);
			if (if_block1) if_block1.m(div1, null);
			append_dev(div1, t5);
			append_dev(div1, a);
			append_dev(div7, t7);
			append_dev(div7, div2);
			append_dev(div7, t8);
			append_dev(div7, div5);
			append_dev(div5, div3);
			append_dev(div5, t9);
			append_dev(div5, div4);
			append_dev(div7, t10);
			append_dev(div7, div6);

			if (!mounted) {
				dispose = listen_dev(a, "click", /*compileAndRun*/ ctx[7], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*title*/ 1) set_data_dev(t1, /*title*/ ctx[0]);

			if (/*examples*/ ctx[2]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_1$1(ctx);
					if_block0.c();
					if_block0.m(div1, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*share*/ ctx[1]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block$3(ctx);
					if_block1.c();
					if_block1.m(div1, t5);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty & /*isHorizontal*/ 8 && div5_class_value !== (div5_class_value = "editor " + (/*isHorizontal*/ ctx[3] ? "horizontal" : "") + " svelte-1u6d8cy")) {
				attr_dev(div5, "class", div5_class_value);
			}

			if (dirty & /*isActive*/ 16) {
				toggle_class(div6, "isActive", /*isActive*/ ctx[4]);
			}
		},
		i: noop$1,
		o: noop$1,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div7);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$h.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function getIsHorizontal() {
	const hz = new URLSearchParams(window.location.search).get("hz");
	if (hz) return hz === "true";
	return window.innerWidth < 720;
}

function instance$h($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Editor", slots, []);
	let { title } = $$props;
	let { share = false } = $$props;
	let { query = "" } = $$props;
	let { code = "" } = $$props;
	let { examples = true } = $$props;
	const font = new FontFaceObserver("Fira Code");

	const samples = {
		parallelFib() {
			return [
				"fn fib n:",
				"  if n < 2: n",
				"  else: (fib n - 1)",
				"      + (fib n - 2)",
				"",
				"export fn main argv:",
				"  [39 40 41 42]",
				"    -> * [await] |fib|",
				"    -> * (console.log @it)"
			,].join("\n");
		},
		parallelFibAlternate() {
			return [
				"fn fib n:",
				"  if n < 2: n",
				"  else: (fib n - 1)",
				"      + (fib n - 2)",
				"",
				"export fn main argv:",
				"  [39 40 41 42]",
				"    -> * |fib|",
				"    -> * .then (console.log @it)"
			,].join("\n");
		},
		fib() {
			return [
				"fn fib n:",
				"  if n < 2: n",
				"  else: (fib n - 1)",
				"      + (fib n - 2)",
				"",
				"export fn main argv:",
				"  [39 40 41 42]",
				"    -> * fib",
				"    -> * (console.log @it)"
			].join("\n");
		},
		filter() {
			return [
				"export fn main argv:",
				"  0..10 -> .toArray",
				"        -> .filter (@it % 2)",
				"        -> console.log"
			].join("\n");
		},
		reduce() {
			return [
				"export fn main argv:",
				"  0..100 -> .toArray",
				"         -> .reduce (@lhs + @rhs)",
				"         -> console.log"
			].join("\n");
		},
		express() {
			return [
				"-- Note: this code doesn't run in the browser!",
				"import \"js:express\"",
				"",
				"fn hello req res:",
				"  \"Hello world\" -> res.send",
				"",
				"export fn main argv:",
				"  app = express",
				"  app.get \"/\" hello",
				"  app.listen 3000"
			].join("\n");
		}
	};

	function getCode() {
		if (code) return code;

		if (query) {
			const urlParams = new URLSearchParams(window.location.search);
			const code = urlParams.get(query);
			return code || samples.parallelFib();
		}

		return samples.parallelFib();
	}

	let editor;
	let domConsole;
	let isHorizontal = false;

	const setSampleCode = event => {
		const { value } = event.target || "parallelFib";
		const code = samples[value]();
		editor.setValue(code);
	};

	let isActive = false;

	const showMessage = () => {
		$$invalidate(4, isActive = true);
		setTimeout(() => $$invalidate(4, isActive = false), 4000);
	};

	const copyShareURL = event => {
		event.preventDefault();
		const code = editor.getValue();
		const encoded = encodeURIComponent(code);
		const { origin, pathname } = window.location;
		const url = `${origin}${pathname}?${query}=${encoded}`;
		navigator.clipboard.writeText(url);
		showMessage();
	};

	const compileAndRun = event => {
		event.preventDefault();

		(async () => {
			const lines = [];

			console.log = async (...args) => {
				lines.push(args.map(objectInspect).join(" "));
				domConsole.setValue(lines.join("\n"));
			};

			console.error = console.log;

			try {
				const src = editor.getValue();
				const { code } = compile_1(src, "main.clio");
				const main = await run(code);
				const now = performance.now();
				await main();
				const end = performance.now();
				const time = `Took ${Math.round((end - now) * 100) / 100}ms`;
				lines.push(("-").repeat(time));
				lines.push(time);
				domConsole.setValue(lines.join("\n"));
			} catch(error) {
				console.error(error);
			}
		})();
	};

	const makeEditor = async () => {
		$$invalidate(3, isHorizontal = getIsHorizontal());
		const monaco = window.monaco || await loadMonaco();
		monaco.languages.register({ id: "clio" });
		monaco.languages.setMonarchTokensProvider("clio", clio$1);
		monaco.editor.defineTheme("PastelsOnDark", pastelsOnDark);
		monaco.editor.setTheme("PastelsOnDark");

		editor = monaco.editor.create(document.getElementById("clio-pane"), {
			value: getCode(),
			language: "clio",
			fontFamily: "Fira Code",
			fontLigatures: true,
			fontSize: 16
		});

		domConsole = monaco.editor.create(document.getElementById("console-pane"), {
			value: "",
			language: "javascript",
			fontFamily: "Fira Code",
			fontLigatures: true,
			fontSize: 16,
			readOnly: true
		});
	};

	font.load().then(makeEditor);
	const writable_props = ["title", "share", "query", "code", "examples"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Editor> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("title" in $$props) $$invalidate(0, title = $$props.title);
		if ("share" in $$props) $$invalidate(1, share = $$props.share);
		if ("query" in $$props) $$invalidate(8, query = $$props.query);
		if ("code" in $$props) $$invalidate(9, code = $$props.code);
		if ("examples" in $$props) $$invalidate(2, examples = $$props.examples);
	};

	$$self.$capture_state = () => ({
		title,
		share,
		query,
		code,
		examples,
		FontFaceObserver,
		font,
		clio: clio$1,
		loadMonaco,
		pastelsOnDark,
		run,
		compile: compile_1,
		inspect: objectInspect,
		samples,
		getCode,
		getIsHorizontal,
		editor,
		domConsole,
		isHorizontal,
		setSampleCode,
		isActive,
		showMessage,
		copyShareURL,
		compileAndRun,
		makeEditor
	});

	$$self.$inject_state = $$props => {
		if ("title" in $$props) $$invalidate(0, title = $$props.title);
		if ("share" in $$props) $$invalidate(1, share = $$props.share);
		if ("query" in $$props) $$invalidate(8, query = $$props.query);
		if ("code" in $$props) $$invalidate(9, code = $$props.code);
		if ("examples" in $$props) $$invalidate(2, examples = $$props.examples);
		if ("editor" in $$props) editor = $$props.editor;
		if ("domConsole" in $$props) domConsole = $$props.domConsole;
		if ("isHorizontal" in $$props) $$invalidate(3, isHorizontal = $$props.isHorizontal);
		if ("isActive" in $$props) $$invalidate(4, isActive = $$props.isActive);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		title,
		share,
		examples,
		isHorizontal,
		isActive,
		setSampleCode,
		copyShareURL,
		compileAndRun,
		query,
		code
	];
}

class Editor extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(this, options, instance$h, create_fragment$h, safe_not_equal, {
			title: 0,
			share: 1,
			query: 8,
			code: 9,
			examples: 2
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Editor",
			options,
			id: create_fragment$h.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*title*/ ctx[0] === undefined && !("title" in props)) {
			console_1.warn("<Editor> was created without expected prop 'title'");
		}
	}

	get title() {
		throw new Error("<Editor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<Editor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get share() {
		throw new Error("<Editor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set share(value) {
		throw new Error("<Editor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get query() {
		throw new Error("<Editor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set query(value) {
		throw new Error("<Editor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get code() {
		throw new Error("<Editor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set code(value) {
		throw new Error("<Editor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get examples() {
		throw new Error("<Editor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set examples(value) {
		throw new Error("<Editor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/Code.svelte generated by Svelte v3.38.2 */
const file$f = "src/components/Code.svelte";

// (15:0) {:else}
function create_else_block$1(ctx) {
	let div;
	let editor;
	let current;

	editor = new Editor({
			props: {
				code: /*code*/ ctx[0],
				title: "Clio docs",
				examples: false
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			div = element("div");
			create_component(editor.$$.fragment);
			attr_dev(div, "class", "playground svelte-86aajl");
			add_location(div, file$f, 15, 2, 311);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			mount_component(editor, div, null);
			current = true;
		},
		p: function update(ctx, dirty) {
			const editor_changes = {};
			if (dirty & /*code*/ 1) editor_changes.code = /*code*/ ctx[0];
			editor.$set(editor_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(editor.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(editor.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			destroy_component(editor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block$1.name,
		type: "else",
		source: "(15:0) {:else}",
		ctx
	});

	return block;
}

// (13:30) 
function create_if_block_1(ctx) {
	let prism;
	let current;

	prism = new Prism_1({
			props: {
				language: /*language*/ ctx[1],
				code: /*code*/ ctx[0]
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(prism.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(prism, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const prism_changes = {};
			if (dirty & /*language*/ 2) prism_changes.language = /*language*/ ctx[1];
			if (dirty & /*code*/ 1) prism_changes.code = /*code*/ ctx[0];
			prism.$set(prism_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(prism.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(prism.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(prism, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1.name,
		type: "if",
		source: "(13:30) ",
		ctx
	});

	return block;
}

// (11:0) {#if inline}
function create_if_block$2(ctx) {
	let code_1;
	let t;

	const block = {
		c: function create() {
			code_1 = element("code");
			t = text(/*code*/ ctx[0]);
			add_location(code_1, file$f, 11, 2, 220);
		},
		m: function mount(target, anchor) {
			insert_dev(target, code_1, anchor);
			append_dev(code_1, t);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*code*/ 1) set_data_dev(t, /*code*/ ctx[0]);
		},
		i: noop$1,
		o: noop$1,
		d: function destroy(detaching) {
			if (detaching) detach_dev(code_1);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$2.name,
		type: "if",
		source: "(11:0) {#if inline}",
		ctx
	});

	return block;
}

function create_fragment$g(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$2, create_if_block_1, create_else_block$1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*inline*/ ctx[2]) return 0;
		if (/*language*/ ctx[1] !== "clio") return 1;
		return 2;
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
		id: create_fragment$g.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$g($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Code", slots, []);
	let { code } = $$props;
	let { language = "" } = $$props;
	let { inline = false } = $$props;
	const writable_props = ["code", "language", "inline"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Code> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("code" in $$props) $$invalidate(0, code = $$props.code);
		if ("language" in $$props) $$invalidate(1, language = $$props.language);
		if ("inline" in $$props) $$invalidate(2, inline = $$props.inline);
	};

	$$self.$capture_state = () => ({ Prism: Prism_1, Editor, code, language, inline });

	$$self.$inject_state = $$props => {
		if ("code" in $$props) $$invalidate(0, code = $$props.code);
		if ("language" in $$props) $$invalidate(1, language = $$props.language);
		if ("inline" in $$props) $$invalidate(2, inline = $$props.inline);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [code, language, inline];
}

class Code extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$g, create_fragment$g, safe_not_equal, { code: 0, language: 1, inline: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Code",
			options,
			id: create_fragment$g.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*code*/ ctx[0] === undefined && !("code" in props)) {
			console.warn("<Code> was created without expected prop 'code'");
		}
	}

	get code() {
		throw new Error("<Code>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set code(value) {
		throw new Error("<Code>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get language() {
		throw new Error("<Code>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set language(value) {
		throw new Error("<Code>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get inline() {
		throw new Error("<Code>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set inline(value) {
		throw new Error("<Code>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/List.svelte generated by Svelte v3.38.2 */

const file$e = "src/components/List.svelte";

// (8:0) {:else}
function create_else_block(ctx) {
	let ol;
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

	const block = {
		c: function create() {
			ol = element("ol");
			if (default_slot) default_slot.c();
			add_location(ol, file$e, 8, 2, 98);
		},
		m: function mount(target, anchor) {
			insert_dev(target, ol, anchor);

			if (default_slot) {
				default_slot.m(ol, null);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
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
			if (detaching) detach_dev(ol);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block.name,
		type: "else",
		source: "(8:0) {:else}",
		ctx
	});

	return block;
}

// (6:0) {#if bullet === "bullet"}
function create_if_block$1(ctx) {
	let ul;
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

	const block = {
		c: function create() {
			ul = element("ul");
			if (default_slot) default_slot.c();
			add_location(ul, file$e, 6, 2, 70);
		},
		m: function mount(target, anchor) {
			insert_dev(target, ul, anchor);

			if (default_slot) {
				default_slot.m(ul, null);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
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
			if (detaching) detach_dev(ul);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(6:0) {#if bullet === \\\"bullet\\\"}",
		ctx
	});

	return block;
}

function create_fragment$f(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$1, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*bullet*/ ctx[0] === "bullet") return 0;
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
		id: create_fragment$f.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$f($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("List", slots, ['default']);
	let { bullet } = $$props;
	const writable_props = ["bullet"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<List> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("bullet" in $$props) $$invalidate(0, bullet = $$props.bullet);
		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ bullet });

	$$self.$inject_state = $$props => {
		if ("bullet" in $$props) $$invalidate(0, bullet = $$props.bullet);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [bullet, $$scope, slots];
}

class List extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$f, create_fragment$f, safe_not_equal, { bullet: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "List",
			options,
			id: create_fragment$f.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*bullet*/ ctx[0] === undefined && !("bullet" in props)) {
			console.warn("<List> was created without expected prop 'bullet'");
		}
	}

	get bullet() {
		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set bullet(value) {
		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/ListItem.svelte generated by Svelte v3.38.2 */

const file$d = "src/components/ListItem.svelte";

function create_fragment$e(ctx) {
	let li;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			li = element("li");
			if (default_slot) default_slot.c();
			add_location(li, file$d, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);

			if (default_slot) {
				default_slot.m(li, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(li);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$e.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$e($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("ListItem", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ListItem> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class ListItem extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "ListItem",
			options,
			id: create_fragment$e.name
		});
	}
}

/* src/components/Blockquote.svelte generated by Svelte v3.38.2 */

const file$c = "src/components/Blockquote.svelte";

function create_fragment$d(ctx) {
	let blockquote;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			blockquote = element("blockquote");
			if (default_slot) default_slot.c();
			attr_dev(blockquote, "class", "svelte-kvf52e");
			add_location(blockquote, file$c, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, blockquote, anchor);

			if (default_slot) {
				default_slot.m(blockquote, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(blockquote);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$d.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$d($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Blockquote", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Blockquote> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Blockquote extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Blockquote",
			options,
			id: create_fragment$d.name
		});
	}
}

/* src/components/Table.svelte generated by Svelte v3.38.2 */

const file$b = "src/components/Table.svelte";

function create_fragment$c(ctx) {
	let div;
	let table;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			div = element("div");
			table = element("table");
			if (default_slot) default_slot.c();
			attr_dev(table, "class", "svelte-ishs86");
			add_location(table, file$b, 1, 2, 22);
			attr_dev(div, "class", "table svelte-ishs86");
			add_location(div, file$b, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			append_dev(div, table);

			if (default_slot) {
				default_slot.m(table, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$c.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$c($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Table", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Table> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Table extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Table",
			options,
			id: create_fragment$c.name
		});
	}
}

/* src/components/TableHead.svelte generated by Svelte v3.38.2 */

const file$a = "src/components/TableHead.svelte";

function create_fragment$b(ctx) {
	let thead;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			thead = element("thead");
			if (default_slot) default_slot.c();
			attr_dev(thead, "class", "svelte-2la0zw");
			add_location(thead, file$a, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, thead, anchor);

			if (default_slot) {
				default_slot.m(thead, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(thead);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$b.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$b($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TableHead", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableHead> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class TableHead extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TableHead",
			options,
			id: create_fragment$b.name
		});
	}
}

/* src/components/TableRow.svelte generated by Svelte v3.38.2 */

const file$9 = "src/components/TableRow.svelte";

function create_fragment$a(ctx) {
	let tr;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			tr = element("tr");
			if (default_slot) default_slot.c();
			attr_dev(tr, "class", "svelte-7h3kcy");
			add_location(tr, file$9, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, tr, anchor);

			if (default_slot) {
				default_slot.m(tr, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(tr);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$a.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$a($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TableRow", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableRow> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class TableRow extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TableRow",
			options,
			id: create_fragment$a.name
		});
	}
}

/* src/components/TableCell.svelte generated by Svelte v3.38.2 */

const file$8 = "src/components/TableCell.svelte";

function create_fragment$9(ctx) {
	let td;
	let current;
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	const block = {
		c: function create() {
			td = element("td");
			if (default_slot) default_slot.c();
			attr_dev(td, "class", "svelte-4ys92h");
			toggle_class(td, "center", /*center*/ ctx[0]);
			toggle_class(td, "left", /*left*/ ctx[1]);
			toggle_class(td, "right", /*right*/ ctx[2]);
			add_location(td, file$8, 7, 0, 105);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, td, anchor);

			if (default_slot) {
				default_slot.m(td, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
				}
			}

			if (dirty & /*center*/ 1) {
				toggle_class(td, "center", /*center*/ ctx[0]);
			}

			if (dirty & /*left*/ 2) {
				toggle_class(td, "left", /*left*/ ctx[1]);
			}

			if (dirty & /*right*/ 4) {
				toggle_class(td, "right", /*right*/ ctx[2]);
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
			if (detaching) detach_dev(td);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$9.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$9($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TableCell", slots, ['default']);
	let { center = false } = $$props;
	let { left = false } = $$props;
	let { right = false } = $$props;
	const writable_props = ["center", "left", "right"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableCell> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("center" in $$props) $$invalidate(0, center = $$props.center);
		if ("left" in $$props) $$invalidate(1, left = $$props.left);
		if ("right" in $$props) $$invalidate(2, right = $$props.right);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ center, left, right });

	$$self.$inject_state = $$props => {
		if ("center" in $$props) $$invalidate(0, center = $$props.center);
		if ("left" in $$props) $$invalidate(1, left = $$props.left);
		if ("right" in $$props) $$invalidate(2, right = $$props.right);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [center, left, right, $$scope, slots];
}

class TableCell extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$9, create_fragment$9, safe_not_equal, { center: 0, left: 1, right: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TableCell",
			options,
			id: create_fragment$9.name
		});
	}

	get center() {
		throw new Error("<TableCell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set center(value) {
		throw new Error("<TableCell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get left() {
		throw new Error("<TableCell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set left(value) {
		throw new Error("<TableCell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get right() {
		throw new Error("<TableCell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set right(value) {
		throw new Error("<TableCell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/TableHeadCell.svelte generated by Svelte v3.38.2 */

const file$7 = "src/components/TableHeadCell.svelte";

function create_fragment$8(ctx) {
	let th;
	let current;
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	const block = {
		c: function create() {
			th = element("th");
			if (default_slot) default_slot.c();
			attr_dev(th, "class", "svelte-1cdqo6x");
			toggle_class(th, "center", /*center*/ ctx[0]);
			toggle_class(th, "left", /*left*/ ctx[1]);
			toggle_class(th, "right", /*right*/ ctx[2]);
			add_location(th, file$7, 7, 0, 105);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, th, anchor);

			if (default_slot) {
				default_slot.m(th, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
				}
			}

			if (dirty & /*center*/ 1) {
				toggle_class(th, "center", /*center*/ ctx[0]);
			}

			if (dirty & /*left*/ 2) {
				toggle_class(th, "left", /*left*/ ctx[1]);
			}

			if (dirty & /*right*/ 4) {
				toggle_class(th, "right", /*right*/ ctx[2]);
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
			if (detaching) detach_dev(th);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$8.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$8($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TableHeadCell", slots, ['default']);
	let { center = false } = $$props;
	let { left = false } = $$props;
	let { right = false } = $$props;
	const writable_props = ["center", "left", "right"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableHeadCell> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("center" in $$props) $$invalidate(0, center = $$props.center);
		if ("left" in $$props) $$invalidate(1, left = $$props.left);
		if ("right" in $$props) $$invalidate(2, right = $$props.right);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ center, left, right });

	$$self.$inject_state = $$props => {
		if ("center" in $$props) $$invalidate(0, center = $$props.center);
		if ("left" in $$props) $$invalidate(1, left = $$props.left);
		if ("right" in $$props) $$invalidate(2, right = $$props.right);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [center, left, right, $$scope, slots];
}

class TableHeadCell extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { center: 0, left: 1, right: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TableHeadCell",
			options,
			id: create_fragment$8.name
		});
	}

	get center() {
		throw new Error("<TableHeadCell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set center(value) {
		throw new Error("<TableHeadCell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get left() {
		throw new Error("<TableHeadCell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set left(value) {
		throw new Error("<TableHeadCell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get right() {
		throw new Error("<TableHeadCell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set right(value) {
		throw new Error("<TableHeadCell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/components/TableBody.svelte generated by Svelte v3.38.2 */

const file$6 = "src/components/TableBody.svelte";

function create_fragment$7(ctx) {
	let tbody;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			tbody = element("tbody");
			if (default_slot) default_slot.c();
			add_location(tbody, file$6, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, tbody, anchor);

			if (default_slot) {
				default_slot.m(tbody, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(tbody);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$7.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$7($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TableBody", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableBody> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class TableBody extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TableBody",
			options,
			id: create_fragment$7.name
		});
	}
}

/* src/components/Tabs.svelte generated by Svelte v3.38.2 */
const file$5 = "src/components/Tabs.svelte";

function create_fragment$6(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr_dev(div, "class", "tabs svelte-1jj452k");
			add_location(div, file$5, 23, 0, 403);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$6.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$6($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Tabs", slots, ['default']);
	let titleCount = 0;
	let contentCount = 0;
	let current = writable(0);

	const tabs = {
		addTitle() {
			return titleCount++;
		},
		addContent() {
			return contentCount++;
		},
		current
	};

	setContext(tabsContext, tabs);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tabs> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		setContext,
		writable,
		tabsContext,
		titleCount,
		contentCount,
		current,
		tabs
	});

	$$self.$inject_state = $$props => {
		if ("titleCount" in $$props) titleCount = $$props.titleCount;
		if ("contentCount" in $$props) contentCount = $$props.contentCount;
		if ("current" in $$props) current = $$props.current;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [$$scope, slots];
}

class Tabs extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Tabs",
			options,
			id: create_fragment$6.name
		});
	}
}

/* src/components/TabTitles.svelte generated by Svelte v3.38.2 */

const file$4 = "src/components/TabTitles.svelte";

function create_fragment$5(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr_dev(div, "class", "tab-titles svelte-53459g");
			add_location(div, file$4, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
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
	validate_slots("TabTitles", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TabTitles> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class TabTitles extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TabTitles",
			options,
			id: create_fragment$5.name
		});
	}
}

/* src/components/TabTitle.svelte generated by Svelte v3.38.2 */
const file$3 = "src/components/TabTitle.svelte";

function create_fragment$4(ctx) {
	let button;
	let h4;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*#slots*/ ctx[5].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

	const block = {
		c: function create() {
			button = element("button");
			h4 = element("h4");
			if (default_slot) default_slot.c();
			add_location(h4, file$3, 16, 2, 363);
			attr_dev(button, "class", "svelte-1bg7m2b");
			toggle_class(button, "active", /*active*/ ctx[0]);
			add_location(button, file$3, 15, 0, 318);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, button, anchor);
			append_dev(button, h4);

			if (default_slot) {
				default_slot.m(h4, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen_dev(button, "click", /*setActive*/ ctx[2], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
				}
			}

			if (dirty & /*active*/ 1) {
				toggle_class(button, "active", /*active*/ ctx[0]);
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
			if (detaching) detach_dev(button);
			if (default_slot) default_slot.d(detaching);
			mounted = false;
			dispose();
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
	let $current;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TabTitle", slots, ['default']);
	const tabs = getContext(tabsContext);
	const index = tabs.addTitle();
	const current = tabs.current;
	validate_store(current, "current");
	component_subscribe($$self, current, value => $$invalidate(3, $current = value));
	let active = false;
	const setActive = () => set_store_value(current, $current = index, $current);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TabTitle> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		getContext,
		tabsContext,
		tabs,
		index,
		current,
		active,
		setActive,
		$current
	});

	$$self.$inject_state = $$props => {
		if ("active" in $$props) $$invalidate(0, active = $$props.active);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*$current*/ 8) {
			$$invalidate(0, active = $current === index);
		}
	};

	return [active, current, setActive, $current, $$scope, slots];
}

class TabTitle extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TabTitle",
			options,
			id: create_fragment$4.name
		});
	}
}

/* src/components/TabContents.svelte generated by Svelte v3.38.2 */

const file$2 = "src/components/TabContents.svelte";

function create_fragment$3(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr_dev(div, "class", "tab-contents svelte-tt39dy");
			add_location(div, file$2, 0, 0, 0);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
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
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
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
	validate_slots("TabContents", slots, ['default']);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TabContents> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class TabContents extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TabContents",
			options,
			id: create_fragment$3.name
		});
	}
}

/* src/components/TabContent.svelte generated by Svelte v3.38.2 */
const file$1 = "src/components/TabContent.svelte";

// (14:0) {#if active}
function create_if_block(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr_dev(div, "class", "tab-content svelte-qpubne");
			add_location(div, file$1, 14, 2, 288);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
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
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(14:0) {#if active}",
		ctx
	});

	return block;
}

function create_fragment$2(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*active*/ ctx[0] && create_if_block(ctx);

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
			if (/*active*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*active*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block(ctx);
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
	let $current;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("TabContent", slots, ['default']);
	const tabs = getContext(tabsContext);
	const index = tabs.addContent();
	const current = tabs.current;
	validate_store(current, "current");
	component_subscribe($$self, current, value => $$invalidate(2, $current = value));
	let active = false;
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TabContent> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		getContext,
		tabsContext,
		tabs,
		index,
		current,
		active,
		$current
	});

	$$self.$inject_state = $$props => {
		if ("active" in $$props) $$invalidate(0, active = $$props.active);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*$current*/ 4) {
			$$invalidate(0, active = $current === index);
		}
	};

	return [active, current, $current, $$scope, slots];
}

class TabContent extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "TabContent",
			options,
			id: create_fragment$2.name
		});
	}
}

/* src/components/Blocktext.svelte generated by Svelte v3.38.2 */

const file = "src/components/Blocktext.svelte";

function create_fragment$1(ctx) {
	let div2;
	let div0;
	let img;
	let img_src_value;
	let div0_class_value;
	let t;
	let div1;
	let div2_class_value;
	let current;
	const default_slot_template = /*#slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

	const block = {
		c: function create() {
			div2 = element("div");
			div0 = element("div");
			img = element("img");
			t = space();
			div1 = element("div");
			if (default_slot) default_slot.c();
			if (img.src !== (img_src_value = "/" + /*type*/ ctx[0] + "-light.svg")) attr_dev(img, "src", img_src_value);
			attr_dev(img, "alt", /*type*/ ctx[0]);
			attr_dev(img, "class", "svelte-1axdgk4");
			add_location(img, file, 17, 4, 400);
			attr_dev(div0, "class", div0_class_value = "icon " + /*type*/ ctx[0] + " svelte-1axdgk4");
			add_location(div0, file, 16, 2, 370);
			attr_dev(div1, "class", "content svelte-1axdgk4");
			add_location(div1, file, 19, 2, 454);
			attr_dev(div2, "class", div2_class_value = "block " + /*type*/ ctx[0] + " svelte-1axdgk4");
			set_style(div2, "--color", /*color*/ ctx[1]);
			add_location(div2, file, 15, 0, 316);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div2, anchor);
			append_dev(div2, div0);
			append_dev(div0, img);
			append_dev(div2, t);
			append_dev(div2, div1);

			if (default_slot) {
				default_slot.m(div1, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (!current || dirty & /*type*/ 1 && img.src !== (img_src_value = "/" + /*type*/ ctx[0] + "-light.svg")) {
				attr_dev(img, "src", img_src_value);
			}

			if (!current || dirty & /*type*/ 1) {
				attr_dev(img, "alt", /*type*/ ctx[0]);
			}

			if (!current || dirty & /*type*/ 1 && div0_class_value !== (div0_class_value = "icon " + /*type*/ ctx[0] + " svelte-1axdgk4")) {
				attr_dev(div0, "class", div0_class_value);
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
				}
			}

			if (!current || dirty & /*type*/ 1 && div2_class_value !== (div2_class_value = "block " + /*type*/ ctx[0] + " svelte-1axdgk4")) {
				attr_dev(div2, "class", div2_class_value);
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
			if (detaching) detach_dev(div2);
			if (default_slot) default_slot.d(detaching);
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

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Blocktext", slots, ['default']);
	let { type } = $$props;

	const getColor = type => {
		if (type === "check") return "#78c0a8";
		if (type === "exclamation") return "#c02e2e";
		if (type === "info") return "#dd8322";
		if (type === "question") return "#317dd5";
		return "#78c0a8";
	};

	const color = getColor(type);
	const writable_props = ["type"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Blocktext> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("type" in $$props) $$invalidate(0, type = $$props.type);
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ type, getColor, color });

	$$self.$inject_state = $$props => {
		if ("type" in $$props) $$invalidate(0, type = $$props.type);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [type, color, $$scope, slots];
}

class Blocktext extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { type: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Blocktext",
			options,
			id: create_fragment$1.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*type*/ ctx[0] === undefined && !("type" in props)) {
			console.warn("<Blocktext> was created without expected prop 'type'");
		}
	}

	get type() {
		throw new Error("<Blocktext>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set type(value) {
		throw new Error("<Blocktext>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/routes/v0.9.0/index.svelte generated by Svelte v3.38.2 */

// (24:284) <Bold>
function create_default_slot_45(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("Clio");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_45.name,
		type: "slot",
		source: "(24:284) <Bold>",
		ctx
	});

	return block;
}

// (24:302) <Italic>
function create_default_slot_44(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("documentation");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_44.name,
		type: "slot",
		source: "(24:302) <Italic>",
		ctx
	});

	return block;
}

// (24:145) <Paragraph>
function create_default_slot_43(ctx) {
	let t0;
	let image;
	let t1;
	let bold;
	let t2;
	let italic;
	let t3;
	let current;

	image = new Image({
			props: {
				src: "https://gblobscdn.gitbook.com/spaces%2F-LYYAInRjOVo73nXt9Xy%2Favatar.png?alt=media",
				alt: "logo",
				inline: true
			},
			$$inline: true
		});

	bold = new Bold({
			props: {
				$$slots: { default: [create_default_slot_45] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	italic = new Italic({
			props: {
				$$slots: { default: [create_default_slot_44] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			t0 = text("This is the ");
			create_component(image.$$.fragment);
			t1 = space();
			create_component(bold.$$.fragment);
			t2 = space();
			create_component(italic.$$.fragment);
			t3 = text(" generator!");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t0, anchor);
			mount_component(image, target, anchor);
			insert_dev(target, t1, anchor);
			mount_component(bold, target, anchor);
			insert_dev(target, t2, anchor);
			mount_component(italic, target, anchor);
			insert_dev(target, t3, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const bold_changes = {};

			if (dirty & /*$$scope*/ 2) {
				bold_changes.$$scope = { dirty, ctx };
			}

			bold.$set(bold_changes);
			const italic_changes = {};

			if (dirty & /*$$scope*/ 2) {
				italic_changes.$$scope = { dirty, ctx };
			}

			italic.$set(italic_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(image.$$.fragment, local);
			transition_in(bold.$$.fragment, local);
			transition_in(italic.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(image.$$.fragment, local);
			transition_out(bold.$$.fragment, local);
			transition_out(italic.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t0);
			destroy_component(image, detaching);
			if (detaching) detach_dev(t1);
			destroy_component(bold, detaching);
			if (detaching) detach_dev(t2);
			destroy_component(italic, detaching);
			if (detaching) detach_dev(t3);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_43.name,
		type: "slot",
		source: "(24:145) <Paragraph>",
		ctx
	});

	return block;
}

// (24:406) <Link href="https://google.com">
function create_default_slot_42(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("link");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_42.name,
		type: "slot",
		source: "(24:406) <Link href=\\\"https://google.com\\\">",
		ctx
	});

	return block;
}

// (24:355) <Paragraph>
function create_default_slot_41(ctx) {
	let t;
	let link;
	let current;

	link = new Link({
			props: {
				href: "https://google.com",
				$$slots: { default: [create_default_slot_42] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			t = text("This should be in a separate paragraph! ");
			create_component(link.$$.fragment);
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
			mount_component(link, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const link_changes = {};

			if (dirty & /*$$scope*/ 2) {
				link_changes.$$scope = { dirty, ctx };
			}

			link.$set(link_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(link.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(link.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
			destroy_component(link, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_41.name,
		type: "slot",
		source: "(24:355) <Paragraph>",
		ctx
	});

	return block;
}

// (24:597) <Paragraph>
function create_default_slot_40(ctx) {
	let t0;
	let code;
	let t1;
	let current;

	code = new Code({
			props: { code: "npm i -g clio", inline: true },
			$$inline: true
		});

	const block = {
		c: function create() {
			t0 = text("You can install > clio using the ");
			create_component(code.$$.fragment);
			t1 = text(" command:");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t0, anchor);
			mount_component(code, target, anchor);
			insert_dev(target, t1, anchor);
			current = true;
		},
		p: noop$1,
		i: function intro(local) {
			if (current) return;
			transition_in(code.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(code.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t0);
			destroy_component(code, detaching);
			if (detaching) detach_dev(t1);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_40.name,
		type: "slot",
		source: "(24:597) <Paragraph>",
		ctx
	});

	return block;
}

// (25:102) <ListItem>
function create_default_slot_39(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("this");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_39.name,
		type: "slot",
		source: "(25:102) <ListItem>",
		ctx
	});

	return block;
}

// (25:162) <ListItem>
function create_default_slot_38(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("a");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_38.name,
		type: "slot",
		source: "(25:162) <ListItem>",
		ctx
	});

	return block;
}

// (25:184) <ListItem>
function create_default_slot_37(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("b");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_37.name,
		type: "slot",
		source: "(25:184) <ListItem>",
		ctx
	});

	return block;
}

// (25:206) <ListItem>
function create_default_slot_36(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("c");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_36.name,
		type: "slot",
		source: "(25:206) <ListItem>",
		ctx
	});

	return block;
}

// (25:139) <List bullet="numeric">
function create_default_slot_35(ctx) {
	let listitem0;
	let listitem1;
	let listitem2;
	let current;

	listitem0 = new ListItem({
			props: {
				$$slots: { default: [create_default_slot_38] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	listitem1 = new ListItem({
			props: {
				$$slots: { default: [create_default_slot_37] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	listitem2 = new ListItem({
			props: {
				$$slots: { default: [create_default_slot_36] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(listitem0.$$.fragment);
			create_component(listitem1.$$.fragment);
			create_component(listitem2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(listitem0, target, anchor);
			mount_component(listitem1, target, anchor);
			mount_component(listitem2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const listitem0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				listitem0_changes.$$scope = { dirty, ctx };
			}

			listitem0.$set(listitem0_changes);
			const listitem1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				listitem1_changes.$$scope = { dirty, ctx };
			}

			listitem1.$set(listitem1_changes);
			const listitem2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				listitem2_changes.$$scope = { dirty, ctx };
			}

			listitem2.$set(listitem2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(listitem0.$$.fragment, local);
			transition_in(listitem1.$$.fragment, local);
			transition_in(listitem2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(listitem0.$$.fragment, local);
			transition_out(listitem1.$$.fragment, local);
			transition_out(listitem2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(listitem0, detaching);
			destroy_component(listitem1, detaching);
			destroy_component(listitem2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_35.name,
		type: "slot",
		source: "(25:139) <List bullet=\\\"numeric\\\">",
		ctx
	});

	return block;
}

// (25:127) <ListItem>
function create_default_slot_34(ctx) {
	let t;
	let list;
	let current;

	list = new List({
			props: {
				bullet: "numeric",
				$$slots: { default: [create_default_slot_35] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			t = text("is");
			create_component(list.$$.fragment);
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
			mount_component(list, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const list_changes = {};

			if (dirty & /*$$scope*/ 2) {
				list_changes.$$scope = { dirty, ctx };
			}

			list.$set(list_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(list.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(list.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
			destroy_component(list, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_34.name,
		type: "slot",
		source: "(25:127) <ListItem>",
		ctx
	});

	return block;
}

// (25:246) <ListItem>
function create_default_slot_33(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("list");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_33.name,
		type: "slot",
		source: "(25:246) <ListItem>",
		ctx
	});

	return block;
}

// (25:80) <List bullet="bullet">
function create_default_slot_32(ctx) {
	let listitem0;
	let listitem1;
	let listitem2;
	let current;

	listitem0 = new ListItem({
			props: {
				$$slots: { default: [create_default_slot_39] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	listitem1 = new ListItem({
			props: {
				$$slots: { default: [create_default_slot_34] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	listitem2 = new ListItem({
			props: {
				$$slots: { default: [create_default_slot_33] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(listitem0.$$.fragment);
			create_component(listitem1.$$.fragment);
			create_component(listitem2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(listitem0, target, anchor);
			mount_component(listitem1, target, anchor);
			mount_component(listitem2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const listitem0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				listitem0_changes.$$scope = { dirty, ctx };
			}

			listitem0.$set(listitem0_changes);
			const listitem1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				listitem1_changes.$$scope = { dirty, ctx };
			}

			listitem1.$set(listitem1_changes);
			const listitem2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				listitem2_changes.$$scope = { dirty, ctx };
			}

			listitem2.$set(listitem2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(listitem0.$$.fragment, local);
			transition_in(listitem1.$$.fragment, local);
			transition_in(listitem2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(listitem0.$$.fragment, local);
			transition_out(listitem1.$$.fragment, local);
			transition_out(listitem2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(listitem0, detaching);
			destroy_component(listitem1, detaching);
			destroy_component(listitem2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_32.name,
		type: "slot",
		source: "(25:80) <List bullet=\\\"bullet\\\">",
		ctx
	});

	return block;
}

// (25:324) <Bold>
function create_default_slot_31(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("Clio");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_31.name,
		type: "slot",
		source: "(25:324) <Bold>",
		ctx
	});

	return block;
}

// (25:312) <Blockquote>
function create_default_slot_30(ctx) {
	let bold;
	let t;
	let current;

	bold = new Bold({
			props: {
				$$slots: { default: [create_default_slot_31] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(bold.$$.fragment);
			t = text(" is great :)");
		},
		m: function mount(target, anchor) {
			mount_component(bold, target, anchor);
			insert_dev(target, t, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const bold_changes = {};

			if (dirty & /*$$scope*/ 2) {
				bold_changes.$$scope = { dirty, ctx };
			}

			bold.$set(bold_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(bold.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(bold.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(bold, detaching);
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_30.name,
		type: "slot",
		source: "(25:312) <Blockquote>",
		ctx
	});

	return block;
}

// (25:428) <TableHeadCell left>
function create_default_slot_29(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("head");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_29.name,
		type: "slot",
		source: "(25:428) <TableHeadCell left>",
		ctx
	});

	return block;
}

// (25:469) <TableHeadCell center>
function create_default_slot_28(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("center");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_28.name,
		type: "slot",
		source: "(25:469) <TableHeadCell center>",
		ctx
	});

	return block;
}

// (25:513) <TableHeadCell right>
function create_default_slot_27(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("head ");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_27.name,
		type: "slot",
		source: "(25:513) <TableHeadCell right>",
		ctx
	});

	return block;
}

// (25:418) <TableRow>
function create_default_slot_26(ctx) {
	let tableheadcell0;
	let tableheadcell1;
	let tableheadcell2;
	let current;

	tableheadcell0 = new TableHeadCell({
			props: {
				left: true,
				$$slots: { default: [create_default_slot_29] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tableheadcell1 = new TableHeadCell({
			props: {
				center: true,
				$$slots: { default: [create_default_slot_28] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tableheadcell2 = new TableHeadCell({
			props: {
				right: true,
				$$slots: { default: [create_default_slot_27] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tableheadcell0.$$.fragment);
			create_component(tableheadcell1.$$.fragment);
			create_component(tableheadcell2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tableheadcell0, target, anchor);
			mount_component(tableheadcell1, target, anchor);
			mount_component(tableheadcell2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tableheadcell0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tableheadcell0_changes.$$scope = { dirty, ctx };
			}

			tableheadcell0.$set(tableheadcell0_changes);
			const tableheadcell1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tableheadcell1_changes.$$scope = { dirty, ctx };
			}

			tableheadcell1.$set(tableheadcell1_changes);
			const tableheadcell2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tableheadcell2_changes.$$scope = { dirty, ctx };
			}

			tableheadcell2.$set(tableheadcell2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tableheadcell0.$$.fragment, local);
			transition_in(tableheadcell1.$$.fragment, local);
			transition_in(tableheadcell2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tableheadcell0.$$.fragment, local);
			transition_out(tableheadcell1.$$.fragment, local);
			transition_out(tableheadcell2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tableheadcell0, detaching);
			destroy_component(tableheadcell1, detaching);
			destroy_component(tableheadcell2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_26.name,
		type: "slot",
		source: "(25:418) <TableRow>",
		ctx
	});

	return block;
}

// (25:407) <TableHead>
function create_default_slot_25(ctx) {
	let tablerow;
	let current;

	tablerow = new TableRow({
			props: {
				$$slots: { default: [create_default_slot_26] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tablerow.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tablerow, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tablerow_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablerow_changes.$$scope = { dirty, ctx };
			}

			tablerow.$set(tablerow_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tablerow.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tablerow.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tablerow, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_25.name,
		type: "slot",
		source: "(25:407) <TableHead>",
		ctx
	});

	return block;
}

// (25:599) <TableCell left>
function create_default_slot_24(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_24.name,
		type: "slot",
		source: "(25:599) <TableCell left>",
		ctx
	});

	return block;
}

// (25:632) <TableCell center>
function create_default_slot_23(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_23.name,
		type: "slot",
		source: "(25:632) <TableCell center>",
		ctx
	});

	return block;
}

// (25:666) <TableCell right>
function create_default_slot_22(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body ");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_22.name,
		type: "slot",
		source: "(25:666) <TableCell right>",
		ctx
	});

	return block;
}

// (25:589) <TableRow>
function create_default_slot_21(ctx) {
	let tablecell0;
	let tablecell1;
	let tablecell2;
	let current;

	tablecell0 = new TableCell({
			props: {
				left: true,
				$$slots: { default: [create_default_slot_24] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablecell1 = new TableCell({
			props: {
				center: true,
				$$slots: { default: [create_default_slot_23] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablecell2 = new TableCell({
			props: {
				right: true,
				$$slots: { default: [create_default_slot_22] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tablecell0.$$.fragment);
			create_component(tablecell1.$$.fragment);
			create_component(tablecell2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tablecell0, target, anchor);
			mount_component(tablecell1, target, anchor);
			mount_component(tablecell2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tablecell0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell0_changes.$$scope = { dirty, ctx };
			}

			tablecell0.$set(tablecell0_changes);
			const tablecell1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell1_changes.$$scope = { dirty, ctx };
			}

			tablecell1.$set(tablecell1_changes);
			const tablecell2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell2_changes.$$scope = { dirty, ctx };
			}

			tablecell2.$set(tablecell2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tablecell0.$$.fragment, local);
			transition_in(tablecell1.$$.fragment, local);
			transition_in(tablecell2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tablecell0.$$.fragment, local);
			transition_out(tablecell1.$$.fragment, local);
			transition_out(tablecell2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tablecell0, detaching);
			destroy_component(tablecell1, detaching);
			destroy_component(tablecell2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_21.name,
		type: "slot",
		source: "(25:589) <TableRow>",
		ctx
	});

	return block;
}

// (25:721) <TableCell left>
function create_default_slot_20(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_20.name,
		type: "slot",
		source: "(25:721) <TableCell left>",
		ctx
	});

	return block;
}

// (25:754) <TableCell center>
function create_default_slot_19(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_19.name,
		type: "slot",
		source: "(25:754) <TableCell center>",
		ctx
	});

	return block;
}

// (25:788) <TableCell right>
function create_default_slot_18(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body ");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_18.name,
		type: "slot",
		source: "(25:788) <TableCell right>",
		ctx
	});

	return block;
}

// (25:711) <TableRow>
function create_default_slot_17(ctx) {
	let tablecell0;
	let tablecell1;
	let tablecell2;
	let current;

	tablecell0 = new TableCell({
			props: {
				left: true,
				$$slots: { default: [create_default_slot_20] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablecell1 = new TableCell({
			props: {
				center: true,
				$$slots: { default: [create_default_slot_19] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablecell2 = new TableCell({
			props: {
				right: true,
				$$slots: { default: [create_default_slot_18] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tablecell0.$$.fragment);
			create_component(tablecell1.$$.fragment);
			create_component(tablecell2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tablecell0, target, anchor);
			mount_component(tablecell1, target, anchor);
			mount_component(tablecell2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tablecell0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell0_changes.$$scope = { dirty, ctx };
			}

			tablecell0.$set(tablecell0_changes);
			const tablecell1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell1_changes.$$scope = { dirty, ctx };
			}

			tablecell1.$set(tablecell1_changes);
			const tablecell2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell2_changes.$$scope = { dirty, ctx };
			}

			tablecell2.$set(tablecell2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tablecell0.$$.fragment, local);
			transition_in(tablecell1.$$.fragment, local);
			transition_in(tablecell2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tablecell0.$$.fragment, local);
			transition_out(tablecell1.$$.fragment, local);
			transition_out(tablecell2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tablecell0, detaching);
			destroy_component(tablecell1, detaching);
			destroy_component(tablecell2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_17.name,
		type: "slot",
		source: "(25:711) <TableRow>",
		ctx
	});

	return block;
}

// (25:843) <TableCell left>
function create_default_slot_16(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_16.name,
		type: "slot",
		source: "(25:843) <TableCell left>",
		ctx
	});

	return block;
}

// (25:876) <TableCell center>
function create_default_slot_15(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_15.name,
		type: "slot",
		source: "(25:876) <TableCell center>",
		ctx
	});

	return block;
}

// (25:910) <TableCell right>
function create_default_slot_14(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("body ");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_14.name,
		type: "slot",
		source: "(25:910) <TableCell right>",
		ctx
	});

	return block;
}

// (25:833) <TableRow>
function create_default_slot_13(ctx) {
	let tablecell0;
	let tablecell1;
	let tablecell2;
	let current;

	tablecell0 = new TableCell({
			props: {
				left: true,
				$$slots: { default: [create_default_slot_16] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablecell1 = new TableCell({
			props: {
				center: true,
				$$slots: { default: [create_default_slot_15] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablecell2 = new TableCell({
			props: {
				right: true,
				$$slots: { default: [create_default_slot_14] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tablecell0.$$.fragment);
			create_component(tablecell1.$$.fragment);
			create_component(tablecell2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tablecell0, target, anchor);
			mount_component(tablecell1, target, anchor);
			mount_component(tablecell2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tablecell0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell0_changes.$$scope = { dirty, ctx };
			}

			tablecell0.$set(tablecell0_changes);
			const tablecell1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell1_changes.$$scope = { dirty, ctx };
			}

			tablecell1.$set(tablecell1_changes);
			const tablecell2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablecell2_changes.$$scope = { dirty, ctx };
			}

			tablecell2.$set(tablecell2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tablecell0.$$.fragment, local);
			transition_in(tablecell1.$$.fragment, local);
			transition_in(tablecell2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tablecell0.$$.fragment, local);
			transition_out(tablecell1.$$.fragment, local);
			transition_out(tablecell2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tablecell0, detaching);
			destroy_component(tablecell1, detaching);
			destroy_component(tablecell2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_13.name,
		type: "slot",
		source: "(25:833) <TableRow>",
		ctx
	});

	return block;
}

// (25:578) <TableBody>
function create_default_slot_12(ctx) {
	let tablerow0;
	let tablerow1;
	let tablerow2;
	let current;

	tablerow0 = new TableRow({
			props: {
				$$slots: { default: [create_default_slot_21] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablerow1 = new TableRow({
			props: {
				$$slots: { default: [create_default_slot_17] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablerow2 = new TableRow({
			props: {
				$$slots: { default: [create_default_slot_13] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tablerow0.$$.fragment);
			create_component(tablerow1.$$.fragment);
			create_component(tablerow2.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tablerow0, target, anchor);
			mount_component(tablerow1, target, anchor);
			mount_component(tablerow2, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tablerow0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablerow0_changes.$$scope = { dirty, ctx };
			}

			tablerow0.$set(tablerow0_changes);
			const tablerow1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablerow1_changes.$$scope = { dirty, ctx };
			}

			tablerow1.$set(tablerow1_changes);
			const tablerow2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablerow2_changes.$$scope = { dirty, ctx };
			}

			tablerow2.$set(tablerow2_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tablerow0.$$.fragment, local);
			transition_in(tablerow1.$$.fragment, local);
			transition_in(tablerow2.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tablerow0.$$.fragment, local);
			transition_out(tablerow1.$$.fragment, local);
			transition_out(tablerow2.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tablerow0, detaching);
			destroy_component(tablerow1, detaching);
			destroy_component(tablerow2, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_12.name,
		type: "slot",
		source: "(25:578) <TableBody>",
		ctx
	});

	return block;
}

// (25:400) <Table>
function create_default_slot_11(ctx) {
	let tablehead;
	let tablebody;
	let current;

	tablehead = new TableHead({
			props: {
				$$slots: { default: [create_default_slot_25] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tablebody = new TableBody({
			props: {
				$$slots: { default: [create_default_slot_12] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tablehead.$$.fragment);
			create_component(tablebody.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tablehead, target, anchor);
			mount_component(tablebody, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tablehead_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablehead_changes.$$scope = { dirty, ctx };
			}

			tablehead.$set(tablehead_changes);
			const tablebody_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tablebody_changes.$$scope = { dirty, ctx };
			}

			tablebody.$set(tablebody_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tablehead.$$.fragment, local);
			transition_in(tablebody.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tablehead.$$.fragment, local);
			transition_out(tablebody.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tablehead, detaching);
			destroy_component(tablebody, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_11.name,
		type: "slot",
		source: "(25:400) <Table>",
		ctx
	});

	return block;
}

// (25:1024) <TabTitle>
function create_default_slot_10(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("clio.toml");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_10.name,
		type: "slot",
		source: "(25:1024) <TabTitle>",
		ctx
	});

	return block;
}

// (25:1054) <TabTitle>
function create_default_slot_9(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("main.clio");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_9.name,
		type: "slot",
		source: "(25:1054) <TabTitle>",
		ctx
	});

	return block;
}

// (25:1013) <TabTitles>
function create_default_slot_8(ctx) {
	let tabtitle0;
	let tabtitle1;
	let current;

	tabtitle0 = new TabTitle({
			props: {
				$$slots: { default: [create_default_slot_10] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tabtitle1 = new TabTitle({
			props: {
				$$slots: { default: [create_default_slot_9] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tabtitle0.$$.fragment);
			create_component(tabtitle1.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tabtitle0, target, anchor);
			mount_component(tabtitle1, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tabtitle0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabtitle0_changes.$$scope = { dirty, ctx };
			}

			tabtitle0.$set(tabtitle0_changes);
			const tabtitle1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabtitle1_changes.$$scope = { dirty, ctx };
			}

			tabtitle1.$set(tabtitle1_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tabtitle0.$$.fragment, local);
			transition_in(tabtitle1.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tabtitle0.$$.fragment, local);
			transition_out(tabtitle1.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tabtitle0, detaching);
			destroy_component(tabtitle1, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_8.name,
		type: "slot",
		source: "(25:1013) <TabTitles>",
		ctx
	});

	return block;
}

// (25:1109) <TabContent>
function create_default_slot_7(ctx) {
	let code;
	let current;

	code = new Code({
			props: {
				code: `[build]
src = "src"
destination = "dest"`,
				language: "toml"
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(code.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(code, target, anchor);
			current = true;
		},
		p: noop$1,
		i: function intro(local) {
			if (current) return;
			transition_in(code.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(code.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(code, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_7.name,
		type: "slot",
		source: "(25:1109) <TabContent>",
		ctx
	});

	return block;
}

// (27:53) <TabContent>
function create_default_slot_6(ctx) {
	let code;
	let current;

	code = new Code({
			props: {
				code: `export fn main argv:
  console.log argv`,
				language: "js"
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(code.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(code, target, anchor);
			current = true;
		},
		p: noop$1,
		i: function intro(local) {
			if (current) return;
			transition_in(code.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(code.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(code, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_6.name,
		type: "slot",
		source: "(27:53) <TabContent>",
		ctx
	});

	return block;
}

// (25:1096) <TabContents>
function create_default_slot_5(ctx) {
	let tabcontent0;
	let tabcontent1;
	let current;

	tabcontent0 = new TabContent({
			props: {
				$$slots: { default: [create_default_slot_7] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tabcontent1 = new TabContent({
			props: {
				$$slots: { default: [create_default_slot_6] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tabcontent0.$$.fragment);
			create_component(tabcontent1.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tabcontent0, target, anchor);
			mount_component(tabcontent1, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tabcontent0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabcontent0_changes.$$scope = { dirty, ctx };
			}

			tabcontent0.$set(tabcontent0_changes);
			const tabcontent1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabcontent1_changes.$$scope = { dirty, ctx };
			}

			tabcontent1.$set(tabcontent1_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tabcontent0.$$.fragment, local);
			transition_in(tabcontent1.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tabcontent0.$$.fragment, local);
			transition_out(tabcontent1.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tabcontent0, detaching);
			destroy_component(tabcontent1, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_5.name,
		type: "slot",
		source: "(25:1096) <TabContents>",
		ctx
	});

	return block;
}

// (25:1007) <Tabs>
function create_default_slot_4(ctx) {
	let tabtitles;
	let tabcontents;
	let current;

	tabtitles = new TabTitles({
			props: {
				$$slots: { default: [create_default_slot_8] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	tabcontents = new TabContents({
			props: {
				$$slots: { default: [create_default_slot_5] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(tabtitles.$$.fragment);
			create_component(tabcontents.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(tabtitles, target, anchor);
			mount_component(tabcontents, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const tabtitles_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabtitles_changes.$$scope = { dirty, ctx };
			}

			tabtitles.$set(tabtitles_changes);
			const tabcontents_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabcontents_changes.$$scope = { dirty, ctx };
			}

			tabcontents.$set(tabcontents_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(tabtitles.$$.fragment, local);
			transition_in(tabcontents.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(tabtitles.$$.fragment, local);
			transition_out(tabcontents.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(tabtitles, detaching);
			destroy_component(tabcontents, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_4.name,
		type: "slot",
		source: "(25:1007) <Tabs>",
		ctx
	});

	return block;
}

// (28:102) <Blocktext type={"info"}>
function create_default_slot_3(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("Just for your info!");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_3.name,
		type: "slot",
		source: "(28:102) <Blocktext type={\\\"info\\\"}>",
		ctx
	});

	return block;
}

// (28:158) <Blocktext type={"exclamation"}>
function create_default_slot_2(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("DANGER!");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_2.name,
		type: "slot",
		source: "(28:158) <Blocktext type={\\\"exclamation\\\"}>",
		ctx
	});

	return block;
}

// (28:209) <Blocktext type={"question"}>
function create_default_slot_1(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("How do I do that?");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_1.name,
		type: "slot",
		source: "(28:209) <Blocktext type={\\\"question\\\"}>",
		ctx
	});

	return block;
}

// (28:267) <Blocktext type={"check"}>
function create_default_slot(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("Congrats!");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot.name,
		type: "slot",
		source: "(28:267) <Blocktext type={\\\"check\\\"}>",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let title0;
	let paragraph0;
	let paragraph1;
	let image;
	let title1;
	let paragraph2;
	let code0;
	let title2;
	let code1;
	let title3;
	let list;
	let title4;
	let blockquote;
	let title5;
	let table;
	let title6;
	let tabs;
	let title7;
	let blocktext0;
	let blocktext1;
	let blocktext2;
	let blocktext3;
	let current;

	title0 = new Title({
			props: { level: 1, title: "Hello world" },
			$$inline: true
		});

	paragraph0 = new Paragraph({
			props: {
				$$slots: { default: [create_default_slot_43] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	paragraph1 = new Paragraph({
			props: {
				$$slots: { default: [create_default_slot_41] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	image = new Image({
			props: {
				src: "https://images.pexels.com/photos/1025469/pexels-photo-1025469.jpeg",
				alt: "image"
			},
			$$inline: true
		});

	title1 = new Title({
			props: { level: 2, title: "Another Section" },
			$$inline: true
		});

	paragraph2 = new Paragraph({
			props: {
				$$slots: { default: [create_default_slot_40] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	code0 = new Code({
			props: { code: `npm i -g clio`, language: "bash" },
			$$inline: true
		});

	title2 = new Title({
			props: { level: 2, title: "Playground" },
			$$inline: true
		});

	code1 = new Code({
			props: {
				code: `export fn main argv:
  console.log "Hello world"`,
				language: "clio"
			},
			$$inline: true
		});

	title3 = new Title({
			props: { level: 2, title: "Lists" },
			$$inline: true
		});

	list = new List({
			props: {
				bullet: "bullet",
				$$slots: { default: [create_default_slot_32] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	title4 = new Title({
			props: { level: 2, title: "Quotes" },
			$$inline: true
		});

	blockquote = new Blockquote({
			props: {
				$$slots: { default: [create_default_slot_30] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	title5 = new Title({
			props: { level: 2, title: "Tables" },
			$$inline: true
		});

	table = new Table({
			props: {
				$$slots: { default: [create_default_slot_11] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	title6 = new Title({
			props: { level: 2, title: "Tabs" },
			$$inline: true
		});

	tabs = new Tabs({
			props: {
				$$slots: { default: [create_default_slot_4] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	title7 = new Title({
			props: { level: 2, title: "Hint" },
			$$inline: true
		});

	blocktext0 = new Blocktext({
			props: {
				type: "info",
				$$slots: { default: [create_default_slot_3] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	blocktext1 = new Blocktext({
			props: {
				type: "exclamation",
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	blocktext2 = new Blocktext({
			props: {
				type: "question",
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	blocktext3 = new Blocktext({
			props: {
				type: "check",
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(title0.$$.fragment);
			create_component(paragraph0.$$.fragment);
			create_component(paragraph1.$$.fragment);
			create_component(image.$$.fragment);
			create_component(title1.$$.fragment);
			create_component(paragraph2.$$.fragment);
			create_component(code0.$$.fragment);
			create_component(title2.$$.fragment);
			create_component(code1.$$.fragment);
			create_component(title3.$$.fragment);
			create_component(list.$$.fragment);
			create_component(title4.$$.fragment);
			create_component(blockquote.$$.fragment);
			create_component(title5.$$.fragment);
			create_component(table.$$.fragment);
			create_component(title6.$$.fragment);
			create_component(tabs.$$.fragment);
			create_component(title7.$$.fragment);
			create_component(blocktext0.$$.fragment);
			create_component(blocktext1.$$.fragment);
			create_component(blocktext2.$$.fragment);
			create_component(blocktext3.$$.fragment);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			mount_component(title0, target, anchor);
			mount_component(paragraph0, target, anchor);
			mount_component(paragraph1, target, anchor);
			mount_component(image, target, anchor);
			mount_component(title1, target, anchor);
			mount_component(paragraph2, target, anchor);
			mount_component(code0, target, anchor);
			mount_component(title2, target, anchor);
			mount_component(code1, target, anchor);
			mount_component(title3, target, anchor);
			mount_component(list, target, anchor);
			mount_component(title4, target, anchor);
			mount_component(blockquote, target, anchor);
			mount_component(title5, target, anchor);
			mount_component(table, target, anchor);
			mount_component(title6, target, anchor);
			mount_component(tabs, target, anchor);
			mount_component(title7, target, anchor);
			mount_component(blocktext0, target, anchor);
			mount_component(blocktext1, target, anchor);
			mount_component(blocktext2, target, anchor);
			mount_component(blocktext3, target, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const paragraph0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				paragraph0_changes.$$scope = { dirty, ctx };
			}

			paragraph0.$set(paragraph0_changes);
			const paragraph1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				paragraph1_changes.$$scope = { dirty, ctx };
			}

			paragraph1.$set(paragraph1_changes);
			const paragraph2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				paragraph2_changes.$$scope = { dirty, ctx };
			}

			paragraph2.$set(paragraph2_changes);
			const list_changes = {};

			if (dirty & /*$$scope*/ 2) {
				list_changes.$$scope = { dirty, ctx };
			}

			list.$set(list_changes);
			const blockquote_changes = {};

			if (dirty & /*$$scope*/ 2) {
				blockquote_changes.$$scope = { dirty, ctx };
			}

			blockquote.$set(blockquote_changes);
			const table_changes = {};

			if (dirty & /*$$scope*/ 2) {
				table_changes.$$scope = { dirty, ctx };
			}

			table.$set(table_changes);
			const tabs_changes = {};

			if (dirty & /*$$scope*/ 2) {
				tabs_changes.$$scope = { dirty, ctx };
			}

			tabs.$set(tabs_changes);
			const blocktext0_changes = {};

			if (dirty & /*$$scope*/ 2) {
				blocktext0_changes.$$scope = { dirty, ctx };
			}

			blocktext0.$set(blocktext0_changes);
			const blocktext1_changes = {};

			if (dirty & /*$$scope*/ 2) {
				blocktext1_changes.$$scope = { dirty, ctx };
			}

			blocktext1.$set(blocktext1_changes);
			const blocktext2_changes = {};

			if (dirty & /*$$scope*/ 2) {
				blocktext2_changes.$$scope = { dirty, ctx };
			}

			blocktext2.$set(blocktext2_changes);
			const blocktext3_changes = {};

			if (dirty & /*$$scope*/ 2) {
				blocktext3_changes.$$scope = { dirty, ctx };
			}

			blocktext3.$set(blocktext3_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(title0.$$.fragment, local);
			transition_in(paragraph0.$$.fragment, local);
			transition_in(paragraph1.$$.fragment, local);
			transition_in(image.$$.fragment, local);
			transition_in(title1.$$.fragment, local);
			transition_in(paragraph2.$$.fragment, local);
			transition_in(code0.$$.fragment, local);
			transition_in(title2.$$.fragment, local);
			transition_in(code1.$$.fragment, local);
			transition_in(title3.$$.fragment, local);
			transition_in(list.$$.fragment, local);
			transition_in(title4.$$.fragment, local);
			transition_in(blockquote.$$.fragment, local);
			transition_in(title5.$$.fragment, local);
			transition_in(table.$$.fragment, local);
			transition_in(title6.$$.fragment, local);
			transition_in(tabs.$$.fragment, local);
			transition_in(title7.$$.fragment, local);
			transition_in(blocktext0.$$.fragment, local);
			transition_in(blocktext1.$$.fragment, local);
			transition_in(blocktext2.$$.fragment, local);
			transition_in(blocktext3.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(title0.$$.fragment, local);
			transition_out(paragraph0.$$.fragment, local);
			transition_out(paragraph1.$$.fragment, local);
			transition_out(image.$$.fragment, local);
			transition_out(title1.$$.fragment, local);
			transition_out(paragraph2.$$.fragment, local);
			transition_out(code0.$$.fragment, local);
			transition_out(title2.$$.fragment, local);
			transition_out(code1.$$.fragment, local);
			transition_out(title3.$$.fragment, local);
			transition_out(list.$$.fragment, local);
			transition_out(title4.$$.fragment, local);
			transition_out(blockquote.$$.fragment, local);
			transition_out(title5.$$.fragment, local);
			transition_out(table.$$.fragment, local);
			transition_out(title6.$$.fragment, local);
			transition_out(tabs.$$.fragment, local);
			transition_out(title7.$$.fragment, local);
			transition_out(blocktext0.$$.fragment, local);
			transition_out(blocktext1.$$.fragment, local);
			transition_out(blocktext2.$$.fragment, local);
			transition_out(blocktext3.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(title0, detaching);
			destroy_component(paragraph0, detaching);
			destroy_component(paragraph1, detaching);
			destroy_component(image, detaching);
			destroy_component(title1, detaching);
			destroy_component(paragraph2, detaching);
			destroy_component(code0, detaching);
			destroy_component(title2, detaching);
			destroy_component(code1, detaching);
			destroy_component(title3, detaching);
			destroy_component(list, detaching);
			destroy_component(title4, detaching);
			destroy_component(blockquote, detaching);
			destroy_component(title5, detaching);
			destroy_component(table, detaching);
			destroy_component(title6, detaching);
			destroy_component(tabs, detaching);
			destroy_component(title7, detaching);
			destroy_component(blocktext0, detaching);
			destroy_component(blocktext1, detaching);
			destroy_component(blocktext2, detaching);
			destroy_component(blocktext3, detaching);
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
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("V0_9_0", slots, []);
	let { sections } = $$props;

	sections = [
		"Hello world",
		"Another Section",
		"Playground",
		"Lists",
		"Quotes",
		"Tables",
		"Tabs",
		"Hint"
	];

	const writable_props = ["sections"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<V0_9_0> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("sections" in $$props) $$invalidate(0, sections = $$props.sections);
	};

	$$self.$capture_state = () => ({
		Title,
		Image,
		Bold,
		Italic,
		Paragraph,
		Link,
		Code,
		List,
		ListItem,
		Blockquote,
		Table,
		TableHead,
		TableRow,
		TableCell,
		TableHeadCell,
		TableBody,
		Tabs,
		TabTitles,
		TabTitle,
		TabContents,
		TabContent,
		Blocktext,
		sections
	});

	$$self.$inject_state = $$props => {
		if ("sections" in $$props) $$invalidate(0, sections = $$props.sections);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [sections];
}

class V0_9_0 extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance, create_fragment, safe_not_equal, { sections: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "V0_9_0",
			options,
			id: create_fragment.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*sections*/ ctx[0] === undefined && !("sections" in props)) {
			console.warn("<V0_9_0> was created without expected prop 'sections'");
		}
	}

	get sections() {
		throw new Error("<V0_9_0>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set sections(value) {
		throw new Error("<V0_9_0>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

export default V0_9_0;
//# sourceMappingURL=index-a7be3e26.js.map
