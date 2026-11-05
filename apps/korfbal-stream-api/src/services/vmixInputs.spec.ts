import {describe, expect, it} from 'vitest';
import {findVmixInput, type VmixInput} from './vmixInputs';

// Reading the XML state is the venue-bridge's job (apps/venue-bridge vmixClient.spec.ts); here only finding an input
const inputs: VmixInput[] = [
  {key: 'aaa-1', number: 1, type: 'Colour', title: 'Zwart', fields: []},
  {key: 'BBB-2', number: 2, type: 'GT', title: 'Score & tijd.gtzip', fields: ['Thuis.Text', 'Uit.Text']},
  {key: 'ccc-3', number: 3, type: 'Xaml', title: '"Ticker"', fields: ['Headline']},
];

describe('findVmixInput', () => {
  it('finds an input by number, key (any case) or exact title, like vMix', () => {
    expect(findVmixInput(inputs, '2')?.key).toBe('BBB-2');
    expect(findVmixInput(inputs, 'bbb-2')?.number).toBe(2);
    expect(findVmixInput(inputs, 'Score & tijd.gtzip')?.number).toBe(2);
  });

  it('does not find a title without its extension or in another case', () => {
    expect(findVmixInput(inputs, 'Score & tijd')).toBeUndefined();
    expect(findVmixInput(inputs, 'zwart')).toBeUndefined();
    expect(findVmixInput(inputs, '9')).toBeUndefined();
  });
});
