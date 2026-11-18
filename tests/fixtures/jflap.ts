const head = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><structure>';

/** A DFA over a and b that accepts words ending in a. Its states lie far from the origin, as JFLAP draws them. */
export const dfaJff = `${head}<type>fa</type><automaton>
<!--The list of states.-->
<state id="0" name="q0"><x>100.0</x><y>200.0</y><initial/></state>
<state id="1" name="q1"><x>300.0</x><y>200.0</y><final/></state>
<!--The list of transitions.-->
<transition><from>0</from><to>1</to><read>a</read></transition>
<transition><from>0</from><to>0</to><read>b</read></transition>
<transition><from>1</from><to>1</to><read>a</read></transition>
<transition><from>1</from><to>0</to><read>b</read></transition>
</automaton></structure>`;

/** An NFA with an empty move. */
export const nfaJff = `${head}<type>fa</type><automaton>
<state id="0" name="start"><x>0</x><y>0</y><initial/></state>
<state id="1" name="end"><x>200</x><y>0</y><final/></state>
<transition><from>0</from><to>1</to><read/></transition>
<transition><from>1</from><to>1</to><read>a</read></transition>
</automaton></structure>`;

/** A PDA for a^n b^n written with pop and push strings. */
export const pdaJff = `${head}<type>pda</type><automaton>
<state id="0" name="q0"><x>0</x><y>0</y><initial/></state>
<state id="1" name="q1"><x>200</x><y>0</y><final/></state>
<transition><from>0</from><to>0</to><read>a</read><pop/><push>A</push></transition>
<transition><from>0</from><to>1</to><read>b</read><pop>A</pop><push/></transition>
<transition><from>1</from><to>1</to><read>b</read><pop>A</pop><push/></transition>
</automaton></structure>`;

/** A Turing machine, which the widget cannot take. */
export const turingJff = `${head}<type>turing</type><automaton><state id="0" name="q0"><x>0</x><y>0</y><initial/></state></automaton></structure>`;

/** A PDA transition that replaces the top symbol with another one. */
export const unsupportedPdaJff = `${head}<type>pda</type><automaton>
<state id="0" name="q0"><x>0</x><y>0</y><initial/></state>
<transition><from>0</from><to>0</to><read>a</read><pop>A</pop><push>B</push></transition>
</automaton></structure>`;

export const notXml = "q0 -> q1";

/** Transitions without a from or to state, and one that points to a state that does not exist. */
export const noFromJff = `${head}<type>fa</type><automaton><state id="0" name="q0"><x>0</x><y>0</y><initial/></state><transition><to>0</to><read>a</read></transition></automaton></structure>`;
export const noToJff = `${head}<type>fa</type><automaton><state id="0" name="q0"><x>0</x><y>0</y><initial/></state><transition><from>0</from><read>a</read></transition></automaton></structure>`;
export const danglingJff = `${head}<type>fa</type><automaton><state id="0" name="q0"><x>0</x><y>0</y><initial/></state><transition><from>0</from><to>7</to><read>a</read></transition></automaton></structure>`;
