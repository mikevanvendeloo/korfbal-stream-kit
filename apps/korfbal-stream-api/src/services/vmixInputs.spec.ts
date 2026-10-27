import {describe, expect, it} from 'vitest';
import {findVmixInput, parseVmixInputs} from './vmixInputs';

const XML = `<?xml version="1.0"?><vmix><version>28</version><inputs>
<input key="aaa-1" number="1" type="Colour" title="Zwart" state="Paused" />
<input key="BBB-2" number="2" type="GT" title="Score &amp; tijd.gtzip" shortTitle="Score">Score &amp; tijd.gtzip
  <text index="0" name="Thuis.Text">Fortuna</text>
  <text index="1" name="Uit.Text"/>
  <image index="0" name="Logo.Source">x.png</image>
</input>
<input key="ccc-3" number="3" type="Xaml" title="&quot;Ticker&quot;"><text index="0" name="Headline">Hallo</text></input>
</inputs><overlays><overlay number="1">2</overlay></overlays></vmix>`;

describe('parseVmixInputs', () => {
  it('reads number, key, type, title and the text fields of each input', () => {
    expect(parseVmixInputs(XML)).toEqual([
      {key: 'aaa-1', number: 1, type: 'Colour', title: 'Zwart', fields: []},
      {key: 'BBB-2', number: 2, type: 'GT', title: 'Score & tijd.gtzip', fields: ['Thuis.Text', 'Uit.Text']},
      {key: 'ccc-3', number: 3, type: 'Xaml', title: '"Ticker"', fields: ['Headline']},
    ]);
  });

  it('gives nothing for something that is not vMix state', () => {
    expect(parseVmixInputs('<html>niet vmix</html>')).toEqual([]);
  });
});

describe('findVmixInput', () => {
  const inputs = parseVmixInputs(XML);

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
