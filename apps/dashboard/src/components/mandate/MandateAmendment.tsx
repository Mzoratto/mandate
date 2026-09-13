export default function MandateAmendment({
  onReview,
}: {
  onReview: () => void;
}) {
  return (
    <div className="amendment">
      <span>Database change blocked</span>
      <button onClick={onReview}>
        Review amendment <span aria-hidden="true">→</span>
      </button>
      <small>Execution remains paused until authority is resolved.</small>
    </div>
  );
}
