import Ember from 'ember';
import Renderer from 'ember-mobiledoc-dom-renderer';
import { RENDER_TYPE } from 'ember-mobiledoc-dom-renderer';
import layout from '../templates/components/render-mobiledoc';

const {
  assert,
  computed,
  run: { join },
  uuid
} = Ember;

const ADD_CARD_HOOK             = 'addComponentCard';
const REMOVE_CARD_HOOK          = 'removeComponentCard';
const ADD_ATOM_HOOK             = 'addComponentAtom';
const REMOVE_ATOM_HOOK          = 'removeComponentAtom';
const CARD_TAG_NAME             = 'div';
const ATOM_TAG_NAME             = 'span';
const UUID_PREFIX               = '__rendered-mobiledoc-entity-';
export const CARD_ELEMENT_CLASS = '__rendered-mobiledoc-card';
export const ATOM_ELEMENT_CLASS = '__rendered-mobiledoc-atom';

const CARD_HOOKS = {
  ADD:    ADD_CARD_HOOK,
  REMOVE: REMOVE_CARD_HOOK
};

const ATOM_HOOKS = {
  ADD:    ADD_ATOM_HOOK,
  REMOVE: REMOVE_ATOM_HOOK
};

function rendererFor(type) {
  let hookNames;

  if (type === 'card') {
    hookNames = CARD_HOOKS;
  } else if (type === 'atom') {
    hookNames = ATOM_HOOKS;
  }

  return function({env, options}) {
    let { onTeardown } = env;
    let addHook    = options[hookNames.ADD];
    let removeHook = options[hookNames.REMOVE];

    let { entity, element } = addHook(...arguments);
    onTeardown(() => removeHook(entity));

    return element;
  };
}

function createComponentCard(name) {
  return {
    name,
    type: RENDER_TYPE,
    render: rendererFor('card')
  };
}

function createComponentAtom(name) {
  return {
    name,
    type: RENDER_TYPE,
    render: rendererFor('atom')
  };
}

export default Ember.Component.extend({
  layout: layout,

  didReceiveAttrs() {
    let mobiledoc = this.get('mobiledoc');
    assert(`Must pass mobiledoc to render-mobiledoc component`, !!mobiledoc);
  },

  unknownCardHandler: null,
  unknownAtomHandler: null,

  cards: [],
  atoms: [],

  // pass in an array of card names that the mobiledoc may have. These
  // map to component names using `cardNameToComponentName`
  cardNames: [],

  // pass in an array of atom names that the mobiledoc may have. These
  // map to component names using `atomNameToComponentName`
  atomNames: [],

  cardOptions: {},

  _allCards: computed('cards', '_mdcCards', function() {
    let { cards, _mdcCards } = this.getProperties('cards', '_mdcCards');
    return [].concat(cards, _mdcCards);
  }),

  _allAtoms: computed('atoms', '_mdcAtoms', function() {
    let { atoms, _mdcAtoms } = this.getProperties('atoms', '_mdcAtoms');
    return [].concat(atoms, _mdcAtoms);
  }),

  _mdcCards: computed('cardNames', function() {
    return this.get('cardNames').map(name => createComponentCard(name));
  }),

  _mdcAtoms: computed('atomNames', function() {
    return this.get('atomNames').map(name => createComponentAtom(name));
  }),

  willRender() {
    let emberRenderer = this.get('renderer');
    let dom = emberRenderer && emberRenderer._dom;
    assert('Unable to get renderer dom helper', !!dom);

    let cards = this.get('_allCards');
    let atoms = this.get('_allAtoms');
    let mobiledoc = this.get('mobiledoc');
    let cardOptions = this.get('_cardOptions');
    let unknownCardHandler = this.get('unknownCardHandler');
    let unknownAtomHandler = this.get('unknownAtomHandler');

    let renderer = new Renderer({atoms, cards, cardOptions, dom, unknownAtomHandler, unknownCardHandler});
    let { result, teardown } = renderer.render(mobiledoc);

    this.set('renderedMobiledoc', result);
    this._teardownRender = teardown;

    this._super(...arguments);
  },

  _cardOptions: computed('cardOptions', function() {
    return Ember.merge({}, this.get('cardOptions'), this.get('_componentCardOptions'));
  }),

  _componentCardOptions: computed(function() {
    return {
      [ADD_CARD_HOOK]: ({env, options, payload}) => {
        let { name: cardName, dom } = env;
        let classNames = [CARD_ELEMENT_CLASS, `${CARD_ELEMENT_CLASS}-${cardName}`];
        let element = this._createElement(dom, CARD_TAG_NAME, classNames);
        let componentName = this.cardNameToComponentName(cardName);

        let card = {
          componentName,
          destinationElementId: element.getAttribute('id'),
          payload
        };
        this.addCard(card);
        return { card, element };
      },
      [ADD_ATOM_HOOK]: ({env, options, value, payload}) => {
        let { name: atomName, dom } = env;
        let classNames = [ATOM_ELEMENT_CLASS, `${ATOM_ELEMENT_CLASS}-${atomName}`];
        let element = this._createElement(dom, ATOM_TAG_NAME, classNames);
        let componentName = this.atomNameToComponentName(atomName);

        let atom = {
          componentName,
          destinationElementId: element.getAttribute('id'),
          payload,
          value
        };
        this.addAtom(atom);
        return { atom, element };
      },
      [REMOVE_CARD_HOOK]: (card) => this.removeCard(card),
      [REMOVE_ATOM_HOOK]: (atom) => this.removeAtom(atom)
    };
  }),

  willDestroyElement() {
    if (this._teardownRender) {
      this._teardownRender();
    }
    return this._super(...arguments);
  },

  // override in subclass to change the mapping of card name -> component name
  cardNameToComponentName(name) {
    return name;
  },

  // override in subclass to change the mapping of atom name -> component name
  atomNameToComponentName(name) {
    return name;
  },

  // @private

  _componentCards: computed(function() {
    return Ember.A();
  }),

  _componentAtoms: computed(function() {
    return Ember.A();
  }),

  addCard(card) {
    this.get('_componentCards').pushObject(card);
  },

  removeCard(card) {
    join(() => {
      this.get('_componentCards').removeObject(card);
    });
  },

  addAtom(atom) {
    this.get('_componentAtoms').pushObject(atom);
  },

  removeAtom(atom) {
    join(() => {
      this.get('_componentAtoms').removeObject(atom);
    });
  },

  generateUuid() {
    return `${UUID_PREFIX}${uuid()}`;
  },

  _createElement(dom, tagName, classNames=[]) {
    let el = dom.createElement(tagName);
    el.setAttribute('id', this.generateUuid());
    el.setAttribute('class', classNames.join(' '));
    return el;
  }
});
