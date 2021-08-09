# -*- coding: utf-8 -*-
from pygments.style import Style
from pygments.token import Token, Operator, Keyword, Name, Generic, Comment, Number, String, Punctuation


class TokyoNightStyle(Style):

    background_color = '#1a1b26'
    styles = {
        Token:              'noinherit #a9b1d6',
        Name.Function:      'noinherit #7aa2f7',
        Name.Label:         'noinherit #73daca',
        Generic.Heading:    '#7dcfff bold',
        Name.Attribute:     'noinherit #bb9af7',
        Operator.Word:      'noinherit #bb9af7',
        Name.Entity:        'noinherit #7aa2f7',
        Generic.Emph:       'underline',
        Generic.Subheading: '#7dcfff bold',
        Comment:            'noinherit #565f89',
        Name.Variable:      'noinherit #c0caf5 italic',
        String:             'noinherit #9ece6a',
        Keyword:            'noinherit #bb9af7',
        Generic.Deleted:    'noinherit #f7768e',
        Keyword.Type:       'noinherit #c0caf5',
        Name.Constant:      'noinherit #ff9e64',
        Comment.Preproc:    'noinherit #565f89',
        Generic.Output:     'noinherit #a9b1d6 bg:#414868',
        Name.Tag:           'noinherit #73daca',
        Number.Float:       'noinherit #ff9e64',
        Generic.Inserted:   '#a9b1d6 bg:#414868 bold',
        Number:             'noinherit #ff9e64',
        Generic.Traceback:  'noinherit #a9b1d6 bg:#414868',
        Punctuation:        'noinherit #2ac3de'
    }


class TokyoNightLightStyle(Style):

    background_color = '#f7f9ff'
    styles = {
        Token:              'noinherit #343b58',
        Name.Function:      'noinherit #34548a',
        Name.Label:         'noinherit #33635c',
        Generic.Heading:    '#0f4b6e bold',
        Name.Attribute:     'noinherit #5a4a78',
        Operator.Word:      'noinherit #5a4a78',
        Name.Entity:        'noinherit #34548a',
        Generic.Emph:       'underline',
        Generic.Subheading: '#0f4b6e bold',
        Comment:            'noinherit #9699a3',
        Name.Variable:      'noinherit #343b58 italic',
        String:             'noinherit #485e30',
        Keyword:            'noinherit #5a4a78',
        Generic.Deleted:    'noinherit #8c4351',
        Keyword.Type:       'noinherit #343b58',
        Name.Constant:      'noinherit #965027',
        Comment.Preproc:    'noinherit #9699a3',
        Generic.Output:     'noinherit #343b58 bg:#0f0f14',
        Name.Tag:           'noinherit #33635c',
        Number.Float:       'noinherit #965027',
        Generic.Inserted:   '#343b58 bg:#0f0f14 bold',
        Number:             'noinherit #965027',
        Generic.Traceback:  'noinherit #343b58 bg:#0f0f14',
        Punctuation:        'noinherit #166775'
    }
