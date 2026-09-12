'use strict';

/** Optional local browser speech. The host owns the speech synthesis queue; one voice instance per page. */
function createBrowserVoice(host) {
  if (!host || !host.speechSynthesis || !host.SpeechSynthesisUtterance)
    throw new Error('This browser does not provide speech synthesis');
  const synth = host.speechSynthesis;
  let active = null;
  return {
    play({ text, locale }) {
      if (active) active.cancel();
      const utterance = new host.SpeechSynthesisUtterance(text);
      utterance.lang = locale === 'en' ? 'en-US' : 'zh-CN';
      utterance.rate = 0.88;
      utterance.pitch = 1.15;
      const voice = synth
        .getVoices()
        .find((item) => item.lang.toLowerCase().startsWith(locale === 'en' ? 'en' : 'zh'));
      if (voice) utterance.voice = voice;
      let resolve,
        settled = false;
      const finished = new Promise((done) => {
        resolve = done;
      });
      const settle = (status) => {
        if (settled) return;
        settled = true;
        utterance.onend = utterance.onerror = null;
        if (active === handle) active = null;
        resolve({ status });
      };
      const handle = {
        finished,
        pause: () => synth.pause(),
        resume: () => synth.resume(),
        cancel: () => {
          if (!settled) {
            synth.cancel();
            settle('cancelled');
          }
        },
      };
      utterance.onend = () => settle('finished');
      utterance.onerror = () => settle('failed');
      active = handle;
      try {
        synth.speak(utterance);
      } catch {
        settle('failed');
      }
      return handle;
    },
  };
}

module.exports = { createBrowserVoice };
