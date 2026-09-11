import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NO_INTEREST_ID } from '../content/questionnaire';
import { contactFormSchema, type ContactFormValues } from '../schemas/consultation';
import type { Option } from '../types';
import { card, choiceRow, choiceRowSelected, textInput } from './ui';

interface Props {
  readonly interestOptions: readonly Option[];
  readonly contactMethods: readonly Option[];
  readonly interests: readonly string[];
  readonly onInterestsChange: (interests: readonly string[]) => void;
  readonly formId: string;
  readonly onSubmit: (contact: ContactFormValues | null) => void;
}

const Field = ({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-body font-medium text-ink">
      {label}
    </label>
    {hint !== undefined && (
      <p id={`${id}-hint`} className="mb-1 text-meta text-ink-soft">
        {hint}
      </p>
    )}
    {children}
    {error !== undefined && (
      <p id={`${id}-error`} className="mt-1 text-meta font-medium text-danger">
        {error}
      </p>
    )}
  </div>
);

export const StayInvolved = ({
  interestOptions,
  contactMethods,
  interests,
  onInterestsChange,
  formId,
  onSubmit,
}: Props) => {
  const wantsContact = interests.length > 0 && !interests.includes(NO_INTEREST_ID);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      organisation: '',
      broadRole: '',
      region: '',
      email: '',
      phone: '',
      preferredContactMethod: 'email',
      preferredContactTime: '',
      comments: '',
    },
  });

  const toggle = (id: string): void => {
    if (id === NO_INTEREST_ID) {
      onInterestsChange(interests.includes(NO_INTEREST_ID) ? [] : [NO_INTEREST_ID]);
      return;
    }
    const withoutNone = interests.filter((value) => value !== NO_INTEREST_ID);
    onInterestsChange(
      withoutNone.includes(id) ? withoutNone.filter((value) => value !== id) : [...withoutNone, id],
    );
  };

  return (
    <form id={formId} noValidate onSubmit={handleSubmit((values) => onSubmit(wantsContact ? values : null))}>
      <div className={`${card} border-accent/40 bg-accent-soft`}>
        <p className="text-ink-soft">
          If you are willing to be contacted about future activities — the project reference group, a trial or
          demonstration, or simply the findings — you may provide your details below. This is optional. Choosing not to
          provide contact details will not affect your consultation response.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          Anything you enter here is stored separately from your answers, and is not linked back to them.
        </p>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-1 text-subtitle font-semibold text-ink">
          Would you be interested in any of the following?
        </legend>
        <p className="mb-3 text-meta text-ink-soft">
          The first few are ways your part of the industry could help directly. Ticking something is an expression of
          interest, not a commitment — somebody will talk it through with you first.
        </p>
        <ul className="grid gap-2">
          {interestOptions.map((option) => {
            const checked = interests.includes(option.id);
            return (
              <li key={option.id}>
                <label className={`${choiceRow} cursor-pointer ${checked ? choiceRowSelected : ''}`}>
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-accent"
                    checked={checked}
                    onChange={() => toggle(option.id)}
                  />
                  <span className="text-body text-ink">{option.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {wantsContact && (
        <section className="mt-6 grid gap-4" aria-label="Your contact details">
          <p className="text-meta text-ink-soft">
            Please give at least an email address or a phone number. Everything else is optional.
          </p>
          <Field id="name" label="Name">
            <input id="name" className={textInput} autoComplete="name" {...register('name')} />
          </Field>
          <Field id="organisation" label="Organisation or business">
            <input id="organisation" className={textInput} autoComplete="organization" {...register('organisation')} />
          </Field>
          <Field id="broadRole" label="Broad role">
            <input id="broadRole" className={textInput} placeholder="For example: grower, packhouse manager" {...register('broadRole')} />
          </Field>
          <Field id="region" label="Region">
            <input id="region" className={textInput} {...register('region')} />
          </Field>
          <Field
            id="email"
            label="Email address"
            error={errors.email?.message}
          >
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={errors.email !== undefined}
              aria-describedby={errors.email === undefined ? undefined : 'email-error'}
              className={textInput}
              {...register('email')}
            />
          </Field>
          <Field id="phone" label="Phone number" error={errors.phone?.message}>
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" className={textInput} {...register('phone')} />
          </Field>
          <Field id="preferredContactMethod" label="Preferred contact method">
            <select id="preferredContactMethod" className={textInput} {...register('preferredContactMethod')}>
              {contactMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="preferredContactTime" label="Preferred time to contact" hint="For example: weekday mornings, or after harvest.">
            <input id="preferredContactTime" className={textInput} aria-describedby="preferredContactTime-hint" {...register('preferredContactTime')} />
          </Field>
          <Field id="comments" label="Any additional comments">
            <textarea id="comments" rows={3} className={textInput} {...register('comments')} />
          </Field>
        </section>
      )}
    </form>
  );
};
