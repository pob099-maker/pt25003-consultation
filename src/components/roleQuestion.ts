/** The role question's id, so the page can take somebody back to it. */
export const ROLE_QUESTION_ID = 'role-question';

/**
 * Takes somebody to the role question when they pressed Next without
 * answering it. Next sits below the list of regions, so on a phone the message
 * appeared well out of sight above, and pressing Next looked to do nothing.
 * Waits until the message is drawn: scrolled before it, the browser moved the
 * page again to make room, and the question slid off the top. A timer, not an
 * animation frame, which a browser holds back in a tab that is not in front.
 */
export const showRoleQuestion = (): void => {
  window.setTimeout(() => {
    const question = document.getElementById(ROLE_QUESTION_ID);
    question?.querySelector<HTMLInputElement>('input[type=radio]')?.focus({ preventScroll: true });
    question?.scrollIntoView({ block: 'start' });
  }, 0);
};
