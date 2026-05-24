import { describe, it } from 'node:test';
import assert from 'node:assert';

import { formatFramerMotion } from '../src/formatters/framer-motion.js';
import { formatMotionOne } from '../src/formatters/motion-one.js';

const designWithSpringAndScroll = {
  meta: { url: 'https://example.com/' },
  motion: {
    durations: [
      { name: 'xs', ms: 120, css: '120ms' },
      { name: 'md', ms: 280, css: '280ms' },
      { name: 'lg', ms: 600, css: '600ms' },
    ],
    easings: [
      { family: 'ease-out', raw: 'cubic-bezier(0.16, 1, 0.3, 1)', count: 42 },
      { family: 'ease-in-out', raw: 'cubic-bezier(0.4, 0, 0.2, 1)', count: 18 },
    ],
    springs: [
      { family: 'spring', raw: 'cubic-bezier(0.34, 1.56, 0.64, 1)', count: 6, overshoot: true },
    ],
    keyframes: [
      {
        name: 'fadeIn',
        used: true,
        usageCount: 4,
        steps: [
          { offset: '0%', style: 'opacity: 0; transform: translateY(8px)' },
          { offset: '100%', style: 'opacity: 1; transform: translateY(0)' },
        ],
      },
    ],
    scrollLinked: { present: true, signals: ['view:reveal'] },
  },
};

const minimalDesign = {
  meta: { url: 'https://minimal.test/' },
  motion: { durations: [], easings: [], springs: [], keyframes: [], scrollLinked: { present: false, signals: [] } },
};

describe('motionlang emitters', () => {
  it('framer-motion: emits spring derived from detected overshoot bezier', () => {
    const out = formatFramerMotion(designWithSpringAndScroll);
    assert.match(out, /export const springs = \{/);
    assert.match(out, /soft: \{ type: 'spring', stiffness: \d+, damping: \d+, mass: 1 \}/);
    // transitions.spring should reference the springs map, not a hard-coded literal
    assert.match(out, /spring: springs\.soft,/);
  });

  it('framer-motion: emits whileInView block when scroll-linked motion is present', () => {
    const out = formatFramerMotion(designWithSpringAndScroll);
    assert.match(out, /export const inView = \{/);
    assert.match(out, /whileInView: variants\.fade\.show/);
  });

  it('framer-motion: reconstructs keyframe variants from used @keyframes', () => {
    const out = formatFramerMotion(designWithSpringAndScroll);
    assert.match(out, /fadeIn: \{/);
    assert.match(out, /"opacity": \["0","1"\]/);
  });

  it('framer-motion: degrades cleanly with no motion signal', () => {
    const out = formatFramerMotion(minimalDesign);
    assert.match(out, /standard: \[0\.25, 1, 0\.5, 1\]/);
    assert.match(out, /soft: \{ type: 'spring'/);
    assert.doesNotMatch(out, /export const inView/);
  });

  it('motion-one: emits animations helpers calling animate()', () => {
    const out = formatMotionOne(designWithSpringAndScroll);
    assert.match(out, /import \{ animate \} from 'motion'/);
    assert.match(out, /export const animations = \{/);
    assert.match(out, /fadeIn: \(target, opts = \{\}\) =>/);
  });

  it('motion-one: emits inView/scroll helpers only when scroll-linked', () => {
    const withScroll = formatMotionOne(designWithSpringAndScroll);
    const without = formatMotionOne(minimalDesign);
    assert.match(withScroll, /import \{ inView, scroll \} from 'motion'/);
    assert.match(withScroll, /export const parallaxY/);
    assert.doesNotMatch(without, /import \{ inView, scroll \}/);
  });

  it('motion-one: spring stiffness/damping respond to overshoot magnitude', () => {
    const out = formatMotionOne(designWithSpringAndScroll);
    const match = out.match(/soft: \{ type: 'spring', stiffness: (\d+), damping: (\d+),/);
    assert.ok(match, 'spring preset present');
    const stiffness = Number(match[1]);
    const damping = Number(match[2]);
    assert.ok(stiffness >= 80 && stiffness <= 700, 'stiffness in expected band');
    assert.ok(damping >= 8 && damping <= 30, 'damping reduced from default by overshoot');
  });
});
