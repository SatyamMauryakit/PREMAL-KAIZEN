export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: 'inherit' }}
    >
      {/* Mountain peaks */}
      <polygon points="20,80 35,50 50,75 65,30 80,80" fill="currentColor" />
    </svg>
  );
};
