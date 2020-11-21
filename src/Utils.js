import {lerp} from './Interpolations';

export function getColor(value) {
  const r = lerp(100, 180, value / 255);
  const g = lerp(90, 180, value / 255);
  const b = lerp(180, 250, value / 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function resampleBuffer(buffer, sampleRate, outSampleRate) {
  if (outSampleRate === sampleRate) {
    return buffer;
  }

  if (outSampleRate > sampleRate) {
    throw new Error('Invalid parameters');
  }

  const sampleRateRatio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  let nextOffsetBuffer, accum, count;

  while (offsetResult < result.length) {
    nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    accum = 0;
    count = 0;

    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = Math.min(1, accum / count) * 0x7fff;

    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result.buffer;
}
