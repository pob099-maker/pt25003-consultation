import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { callbackRequestSchema, type CallbackRequestValues } from '../schemas/consultation';
import { CALL_TIMES, callTimeSummary, nextTimes, toCallbackRecord } from '../services/callback';
import { submitContact } from '../services/submit';
import { choiceRow, choiceRowSelected, primaryButton, secondaryButton, textInput } from './ui';

interface Sent {
  readonly name: string;
  readonly phone: string;
  readonly times: readonly string[];
  readonly queued: boolean;
}

/**
 * "Leave your number and we will ring you", as an alternative to publishing
 * one person's mobile and hoping somebody uses it.
 *
 * It asks four things, one of them optional, because the offer has to be
 * quicker to accept than the form it stands in for. The request goes into the
 * contact list as an ordinary record, so it survives a flat connection in the
 * outbox and turns up where the team is already working.
 */
export const CallbackRequest = () => {
  const questionnaire = useQuestionnaire();
  const [open, setOpen] = useState(false);
  // The button that opened the form is gone once it opens, so focus would
  // otherwise fall back to the top of the page and a screen reader would never
  // hear the form appear.
  const formRef = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CallbackRequestValues>({
    resolver: zodResolver(callbackRequestSchema),
    defaultValues: { name: '', phone: '', times: [], note: '' },
  });

  useEffect(() => {
    if (open) formRef.current?.focus();
  }, [open]);

  const save = async (values: CallbackRequestValues): Promise<void> => {
    setFailed(null);
    const result = await submitContact(toCallbackRecord(values, questionnaire.roundId));
    if (!result.success) {
      setFailed(result.error);
      return;
    }
    setSent({ name: values.name, phone: values.phone, times: values.times, queued: result.data === 'queued' });
  };

  if (sent !== null) {
    return (
      <div className="mt-4 rounded-lg border border-primary bg-selected p-4" role="status">
        <p className="text-body text-ink">
          Thanks {sent.name.split(' ')[0]}. Somebody from the project team will give you a ring on {sent.phone}.
        </p>
        {/* Read back rather than worked into the sentence: the windows are
            labels, and a sentence built around two of them stops being one. */}
        <p className="mt-1 text-body text-ink">Best time to ring: {callTimeSummary(sent.times)}.</p>
        {sent.queued && (
          <p className="mt-2 text-meta text-ink-soft">
            Your request is saved on this device and has not been sent yet, because there was no connection. Open this
            page again when you have signal and it will go through on its own.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button type="button" className={secondaryButton} onClick={() => setOpen(true)}>
          Ask us to ring you
        </button>
        <p className="mt-2 text-meta text-ink-soft">
          Leave a name and a number and somebody from the project team will ring you at a time that suits.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} tabIndex={-1} className="mt-4 grid gap-4" noValidate onSubmit={handleSubmit(save)}>
      <p className="text-meta text-ink-soft">
        We will take your answers over the phone. It usually runs about a quarter of an hour, and you can stop whenever
        you like.
      </p>

      <div>
        <label htmlFor="callback-name" className="mb-1 block text-body font-medium text-ink">
          Your name
        </label>
        <input
          id="callback-name"
          className={textInput}
          autoComplete="name"
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name === undefined ? undefined : 'callback-name-error'}
          {...register('name')}
        />
        {errors.name !== undefined && (
          <p id="callback-name-error" className="mt-1 text-meta font-medium text-danger">
            {errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="callback-phone" className="mb-1 block text-body font-medium text-ink">
          Phone number
        </label>
        <input
          id="callback-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={textInput}
          aria-invalid={errors.phone !== undefined}
          aria-describedby={errors.phone === undefined ? undefined : 'callback-phone-error'}
          {...register('phone')}
        />
        {errors.phone !== undefined && (
          <p id="callback-phone-error" className="mt-1 text-meta font-medium text-danger">
            {errors.phone.message}
          </p>
        )}
      </div>

      <Controller
        control={control}
        name="times"
        render={({ field }) => (
          <fieldset
            // On the group itself, so a screen reader reads the hint, and the
            // complaint, on the way into the boxes rather than after them.
            aria-describedby={
              errors.times === undefined ? 'callback-times-hint' : 'callback-times-hint callback-times-error'
            }
          >
            <legend className="mb-1 text-body font-medium text-ink">When is the best time to ring?</legend>
            <p id="callback-times-hint" className="mb-2 text-meta text-ink-soft">
              Tick whatever suits. We will do our best to ring inside it.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {CALL_TIMES.map((time) => {
                const checked = field.value.includes(time.id);
                return (
                  <li key={time.id}>
                    <label className={`${choiceRow} cursor-pointer ${checked ? choiceRowSelected : ''}`}>
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => field.onChange(nextTimes(field.value, time.id))}
                      />
                      <span className="text-body text-ink">{time.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {errors.times !== undefined && (
              <p id="callback-times-error" className="mt-1 text-meta font-medium text-danger">
                {errors.times.message}
              </p>
            )}
          </fieldset>
        )}
      />

      <div>
        <label htmlFor="callback-note" className="mb-1 block text-body font-medium text-ink">
          Anything we should know before we ring?
        </label>
        <p id="callback-note-hint" className="mb-1 text-meta text-ink-soft">
          Optional. A day that does not suit, or something you want to talk about.
        </p>
        <textarea
          id="callback-note"
          rows={2}
          className={textInput}
          aria-describedby="callback-note-hint"
          {...register('note')}
        />
      </div>

      {failed !== null && (
        <p className="text-meta font-medium text-danger" role="alert">
          {failed}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className={primaryButton} disabled={isSubmitting}>
          {isSubmitting ? 'Sending' : 'Send the request'}
        </button>
        <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>

      <p className="text-meta text-ink-soft">
        Your number is used to arrange the call and for nothing else. It is stored with our contact list, apart from the
        consultation answers, and you can ask us to delete it at any time.
      </p>
    </form>
  );
};
