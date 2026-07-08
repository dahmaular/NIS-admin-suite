import React from "react";

const I = ({ size = 20, children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const HomeIcon = (p) => (
  <I {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></I>
);
export const PenIcon = (p) => (
  <I {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></I>
);
export const ImageIcon = (p) => (
  <I {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></I>
);
export const TargetIcon = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>
);
export const EyeIcon = (p) => (
  <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></I>
);
export const LogoutIcon = (p) => (
  <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></I>
);
export const SearchIcon = (p) => (
  <I {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></I>
);
export const PlusIcon = (p) => (
  <I {...p}><path d="M12 5v14" /><path d="M5 12h14" /></I>
);
export const TrashIcon = (p) => (
  <I {...p}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /></I>
);
export const CopyIcon = (p) => (
  <I {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></I>
);
export const CheckIcon = (p) => (
  <I {...p}><path d="m4 12.5 5.5 5.5L20 6.5" /></I>
);
export const XIcon = (p) => (
  <I {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></I>
);
export const ChevronDownIcon = (p) => (
  <I {...p}><path d="m6 9 6 6 6-6" /></I>
);
export const UploadIcon = (p) => (
  <I {...p}><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></I>
);
export const RefreshIcon = (p) => (
  <I {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></I>
);
export const ExternalIcon = (p) => (
  <I {...p}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></I>
);
export const CrosshairIcon = (p) => (
  <I {...p}><circle cx="12" cy="12" r="8" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M2 12h4" /><path d="M18 12h4" /></I>
);
export const FileIcon = (p) => (
  <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></I>
);
export const LayersIcon = (p) => (
  <I {...p}><path d="m12 2 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></I>
);
export const SparkleIcon = (p) => (
  <I {...p}><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" /></I>
);
export const MonitorIcon = (p) => (
  <I {...p}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></I>
);
export const TabletIcon = (p) => (
  <I {...p}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></I>
);
export const PhoneIcon = (p) => (
  <I {...p}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 18h.01" /></I>
);
export const AlertIcon = (p) => (
  <I {...p}><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></I>
);
export const LinkIcon = (p) => (
  <I {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" /></I>
);
