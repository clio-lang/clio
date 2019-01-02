'use babel';

import LanguageClioView from './language-clio-view';
import { CompositeDisposable } from 'atom';

export default {

  languageClioView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.languageClioView = new LanguageClioView(state.languageClioViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.languageClioView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'language-clio:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.languageClioView.destroy();
  },

  serialize() {
    return {
      languageClioViewState: this.languageClioView.serialize()
    };
  },

  toggle() {
    console.log('LanguageClio was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
