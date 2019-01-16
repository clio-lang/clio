#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Simple telegram bot to highlight clio code"""

from telegram.ext import Updater, CommandHandler, MessageHandler, Filters
import logging
import re

import os, sys, inspect
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
pygment_support = os.path.join(parentdir, 'pygments')
sys.path.insert(0, pygment_support)

from clio import ClioLexer
from pygments import highlight
from pygments.formatters import ImageFormatter
from io import BytesIO
from dracula import DraculaStyle
from PIL import Image, ImageOps

# Enable logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    level=logging.INFO)

logger = logging.getLogger(__name__)


# Define a few command handlers. These usually take the two arguments bot and
# update. Error handlers also receive the raised TelegramError object in error.
def start(bot, update):
    """Send a message when the command /start is issued."""
    update.message.reply_text('Hi!')


def help(bot, update):
    """Send a message when the command /help is issued."""
    update.message.reply_text('Help!')


def reply_highlight(bot, update):
    """Echo the user message."""
    if re.match(r'!clio[\r\n].*?(`{1,3})(.*?)(\1).*', update.message.text_markdown):
        code = re.search(r'(`{1,3})(?P<code>.*)(\1)', update.message.text_markdown, re.MULTILINE | re.DOTALL).group('code')
        code = re.sub(r'\\\*', '*', code)
        formatter = ImageFormatter(font_name='Fira Code', style=DraculaStyle, font_size=16)
        image_data = highlight(code, ClioLexer(), formatter)
        image = BytesIO(image_data)
        image = Image.open(image)
        img_with_border = ImageOps.expand(image, border=50, fill='#282a36') #for dracula
        image = BytesIO()
        img_with_border.save(image, 'PNG')
        image.seek(0)
        image.name = 'highlight.png'
        bot.send_photo(update.message.chat_id, image, reply_to_message_id=update.message.message_id)

def error(bot, update, error):
    """Log Errors caused by Updates."""
    logger.warning('Update "%s" caused error "%s"', update, error)


def main():
    import sys
    """Start the bot."""
    # Create the EventHandler and pass it your bot's token.
    updater = Updater(sys.argv[1])

    # Get the dispatcher to register handlers
    dp = updater.dispatcher

    # on different commands - answer in Telegram
    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(CommandHandler("help", help))

    # on noncommand i.e message - echo the message on Telegram
    dp.add_handler(MessageHandler(Filters.text, reply_highlight))

    # log all errors
    dp.add_error_handler(error)

    # Start the Bot
    updater.start_polling()

    # Run the bot until you press Ctrl-C or the process receives SIGINT,
    # SIGTERM or SIGABRT. This should be used most of the time, since
    # start_polling() is non-blocking and will stop the bot gracefully.
    updater.idle()


if __name__ == '__main__':
    main()
