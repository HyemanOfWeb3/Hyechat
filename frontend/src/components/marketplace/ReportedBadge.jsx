const ReportedBadge = ({ reportedByMe, className = "" }) =>
  reportedByMe ? (
    <span className={`badge badge-ghost badge-sm ${className}`.trim()}>
      Reported
    </span>
  ) : null;

export default ReportedBadge;
