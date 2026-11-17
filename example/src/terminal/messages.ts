/**
 * Customer-facing wording for what a reader asks of the customer. Shared by
 * the Charge and POS tabs.
 */

/**
 * Plain-English text for the prompts a reader can request. The SDK gives us
 * an identifier ('retryCard'); showing it to the customer is our job.
 * See docs/guides/events.md.
 */
export const MESSAGE_TEXT: Record<string, string> = {
  retryCard: 'Please try the card again.',
  insertCard: 'Please insert the card.',
  insertOrSwipeCard: 'Please insert or swipe the card.',
  swipeCard: 'Please swipe the card.',
  removeCard: 'Please remove the card.',
  multipleContactlessCardsDetected:
    'Multiple cards detected. Present just one.',
  tryAnotherReadMethod: 'Please try another way of paying with this card.',
  tryAnotherCard: 'Please try a different card.',
  checkMobileDevice: 'Please check your phone.',
  cardRemovedTooEarly: 'Card removed too early. Please try again.',
}

/** Readable labels for the input methods a reader may be accepting. */
export const INPUT_TEXT: Record<string, string> = {
  tapCard: 'Tap',
  insertCard: 'Insert',
  swipeCard: 'Swipe',
}
