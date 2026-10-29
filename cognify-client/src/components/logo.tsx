import { Link } from "react-router-dom";

export interface CognifyIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: "solid" | "glyph" | "bw";
}

export const CognifyIcon = ({
  size = 32,
  variant = "solid",
  className = "",
  ...props
}: CognifyIconProps) => {
  if (variant === "glyph") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        {/* Outer C Rail */}
        <path
          d="M23 9H10C9.44772 9 9 9.44772 9 10V22C9 22.5523 9.44772 23 10 23H23"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner 45-degree DAG branches */}
        <path
          d="M9 9L16 16L9 23"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.75"
        />
        {/* Forward Dispatch */}
        <path
          d="M16 16H23"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Node Terminals */}
        <circle cx="23" cy="9" r="1.8" fill="currentColor" />
        <circle cx="9" cy="9" r="1.8" fill="currentColor" />
        <circle cx="9" cy="23" r="1.8" fill="currentColor" />
        <circle cx="23" cy="23" r="1.8" fill="currentColor" />
        <circle cx="16" cy="16" r="2.2" fill="currentColor" />
        <circle cx="23" cy="16" r="1.8" fill="currentColor" />
      </svg>
    );
  }

  // Default engineered high-contrast solid badge
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="32" height="32" rx="7" fill="#000000" />
      <rect
        width="32"
        height="32"
        rx="7"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="1"
      />

      {/* Outer C Rail */}
      <path
        d="M23 9H10C9.44772 9 9 9.44772 9 10V22C9 22.5523 9.44772 23 10 23H23"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner 45-degree DAG branches */}
      <path
        d="M9 9L16 16L9 23"
        stroke="#ffffff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.75"
      />

      {/* Forward Dispatch */}
      <path
        d="M16 16H23"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Node Terminals */}
      <circle cx="23" cy="9" r="1.8" fill="#ffffff" />
      <circle cx="9" cy="9" r="1.8" fill="#ffffff" />
      <circle cx="9" cy="23" r="1.8" fill="#ffffff" />
      <circle cx="23" cy="23" r="1.8" fill="#ffffff" />
      <circle cx="16" cy="16" r="2.2" fill="#ffffff" />
      <circle cx="23" cy="16" r="1.8" fill="#ffffff" />
    </svg>
  );
};

export const LogoSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return <CognifyIcon size={24} {...props} />;
};

export const Logo = ({
  size = 28,
  showText = true,
  className = "",
  textClassName = "",
}: {
  size?: number | string;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}) => {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      <CognifyIcon
        size={size}
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      />
      {showText && (
        <span className={`text-[15px] font-semibold tracking-tight text-white ${textClassName}`}>
          Cognify
        </span>
      )}
    </Link>
  );
};
