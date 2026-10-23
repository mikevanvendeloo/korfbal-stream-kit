import {useInterviewPhotos} from '../hooks/useInterviewPhotos';

/** The "Interviewfoto's" switch of the callsheet and Show Caller gear menu (remembered on this device). */
export function InterviewPhotosToggle() {
  const [on, setOn] = useInterviewPhotos();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      title="Foto en rugnummer naast de namen van de gekozen interviews"
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
        on
          ? 'bg-blue-600/20 border-blue-500/40 text-blue-600 dark:text-blue-400'
          : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
      }`}
    >
      <span>Interviewfoto's</span>
      <span className={on ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-white/20'}>{on ? 'AAN' : 'UIT'}</span>
    </button>
  );
}
