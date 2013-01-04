// Copyright 2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview An interface (and partial implementation) for the basic
 * traversal through some piece of the dom.
 * For each different ordered (either in dom or by any other metric) set
 * of "valid selections" (just set from now on), a new
 * base class should be defined that implements this interface. For example,
 * there are subclasses for words, sentences, and lowest-level dom nodes.
 * These classes should all be stateless; this makes testing much more
 * effective at pinpointing errors.
 * For all of the operations in this interface, the position in the dom on
 * which to operate is given by a CursorSelection, see that file for
 * documentation.
 * The two main operations that currently exist for walkers are sync and
 * next. See the docs where those functions are defined.
 * Since most operations are hard to even define if there is no root element,
 * all operations may assume that the selection given is attached to the body
 * node. The behavior is undefined if any part of the selection passed in
 * is not attached to the body. As a user of this class, it is your
 * responsibility to make sure the selection is attached.
 * No operation may visibly modify any of its arguments. In particular, take
 * care with CursorSelections, since setReversed modifies the selection.
 * For all documentation, = refers to the method equals for CursorSelections
 * comparison.
 * Thinking of adding something in this class? Here are some good questions to
 * ask:
 * Is this an operation that applies to any element of any arbitrary set?
 * If not, then it probably doesn't belong here.
 * Does it need to know something other than the set that it operates on?
 * If so, then it probably doesn't belong here.
 *
 * @author stoarca@google.com (Sergiu Toarca)
 */


goog.provide('cvox.AbstractWalker');

goog.require('cvox.CursorSelection');
goog.require('cvox.NavBraille');

/**
 * @constructor
 */
cvox.AbstractWalker = function() {
};

/**
 * This takes a valid CursorSelection and returns the directed-next
 * valid CursorSelection in the dom, or null. For example, if the walker
 * navigates across sentences, this would return the selection of the sentence
 * following the selection passed in. If sel is at the "end" of a section,
 * this method may return null. In the example above, if we try to next on
 * the last sentence in the dom, we would return null.
 * Note that sel must be a valid selection. Undefined behavior if it isn't.
 * There are several invariants that must hold for any subclasses. There may
 * not be explicit tests for these, but subclasses are responsible for ensuring
 * them and callers may assume them:
 * 1) next(next(sel).setReversed(!sel.isReversed())) = sel for all sel if sel
 *    is a valid CursorSelection and next(sel) != null.
 *  That is, the valid elements for this walker are totally ordered; going
 *  forward and then backward returns us to the same cell.
 * 2) next(sel).isReversed() = sel.isReversed() for all sel if sel is a
 *    valid CursorSelection and next(sel) != null.
 *  That is, next preserves direction.
 * @param {!cvox.CursorSelection} sel The valid selection to start moving from.
 * @return {cvox.CursorSelection} Returns the valid selection the walker moves
 * to. null if directed end of section is reached.
 */
cvox.AbstractWalker.prototype.next = goog.abstractMethod;

// TODO (stoarca): These might have to be changed to getValidSectionBeginning
// to provide consistent interfaces for walking tables.
/**
 * Syncs and returns the first valid, non-null selection in the document for
 * this walker.
 * @param {{reversed: (undefined|boolean)}=} kwargs Extra arguments.
 *  reversed: If true, syncs to the page end and returns a reversed selection.
 *    False by default.
 * @return {!cvox.CursorSelection} The valid selection.
 */
cvox.AbstractWalker.prototype.syncToPageBeginning = function(kwargs) {
  kwargs = kwargs || {reversed: false};

  // TODO(stoarca): Does NOT work for TableWalker! The interfaces are not frozen
  // yet, they will be tightened after everything is in the right place.
  return /** @type {!cvox.CursorSelection} */ (this.sync(
      cvox.CursorSelection.fromBody().setReversed(kwargs.reversed)));
};


/**
 * Tries to act on the current item. Displays a disambiguation dialog if
 * more than one action is possible.
 * @param {!cvox.CursorSelection} sel The selection on which to act.
 * @return {boolean} True if some action that could be taken exists.
 */
cvox.AbstractWalker.prototype.act = function(sel) {
  return false;
};

/**
 * This takes an arbitrary CursorSelection and returns a valid CursorSelection,
 * or null. For example, if the walker navigates across
 * text nodes, and the selection passed in is for a single character within a
 * larger text node, this method should return a text node. No restrictions
 * are made as to exactly what selection should be returned, but it should be
 * something "reasonable", and from the user's point of view, "close" to the
 * previous selection. If no such selection exists, null may be returned.
 * Note that, since CursorSelection has a direction, syncing to a selection
 * should make sense in either direction.
 * Note also that, as mentioned in the file overview, this operation has
 * undefined behavior if the input selection is not attached to the body.
 * There are several invariants that must hold for any subclasses. While they
 * may not all be tested for at the time, subclasses are responsible for
 * making sure these hold, and any caller may assume these to be true:
 * 1) sync(sel) = sel iff sel is a valid selection
 *    This defines the set of valid selections for this walker.
 *    Note, in particular, that this implies sync(sync(sel)) = sync(sel)
 *    whenever sync(sel) != null.
 * 2) sync(sel).isReversed() = sel.isReversed() for all sel if sync(sel) != null
 *    That is, sync preserves direction.
 * Why do these restrictions exist? Because it makes it much easier to reason
 * about the effect (and intent) of an operation if we can make these
 * assumptions.
 * @param {!cvox.CursorSelection} sel The (possibly unsynched) selection.
 * @return {cvox.CursorSelection} The synched selection.
 */
cvox.AbstractWalker.prototype.sync = goog.abstractMethod;

/**
 * Returns an array of NavDescriptions that defines what should be said
 * by the tts engine on traversal from prevSel to sel. While this is
 * introducing knowledge (of NavDescriptions) into this class that
 * it shouldn't know, this is currently the best place for this method
 * to reside, as the set of valid CursorSelections must be known.
 * sel must be valid CursorSelections for this walker, prevSel may be any
 * selection. Undefined behavior otherwise.
 * @param {!cvox.CursorSelection} prevSel The valid previous selection.
 * @param {!cvox.CursorSelection} sel The valid current selection.
 * @return {!Array.<!cvox.NavDescription>} The description array.
 */
cvox.AbstractWalker.prototype.getDescription = goog.abstractMethod;

/**
 * Returns a NavBraille that defines what should be brailled on traversal from
 * prevSel to sel.
 * sel must be valid CursorSelections for this walker, prevSel may be any
 * selection. Undefined behavior otherwise.
 * @param {!cvox.CursorSelection} prevSel The valid previous selection.
 * @param {!cvox.CursorSelection} sel The valid current selection.
 * @return {!cvox.NavBraille} The braille description.
 */
cvox.AbstractWalker.prototype.getBraille = goog.abstractMethod;

/**
 * Returns message string of the walker's granularity.
 * @return {string} The message string.
 */
cvox.AbstractWalker.prototype.getGranularityMsg = goog.abstractMethod;