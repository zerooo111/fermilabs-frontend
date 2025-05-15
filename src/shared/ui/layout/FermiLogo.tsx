import * as React from 'react';

const FermiLogo3d = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" {...props}>
    <path
      fill="url(#a)"
      d="M92.611 57.435c-4.08 23.508-26.466 39.236-50 35.13-23.533-4.106-39.303-26.492-35.222-50 4.08-23.508 26.466-39.236 50-35.13 23.533 4.106 39.303 26.492 35.222 50Z"
    />
    <path
      fill="url(#b)"
      fillRule="evenodd"
      d="M18.125 20.606c2.452-1.93 9.28-4.92 17.894-3.316 8.445 1.572 12.17 9.77 14.16 14.147l.31.68c1.908 4.145 7.92 12.818 19.877 12.435 14.947-.478 21.944 6.537 20.036 20.566-.01.217-.016.423-.018.62a43.315 43.315 0 0 0 2.467-8.71c4.08-23.507-11.69-45.893-35.223-50-15.18-2.648-29.883 2.956-39.503 13.578Z"
      clipRule="evenodd"
    />
    <defs>
      <radialGradient
        id="a"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="matrix(50.63364 34.44612 -34.48718 50.694 22 44.5)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#A7DCC0" />
        <stop offset={1} stopColor="#0D292C" />
      </radialGradient>
      <radialGradient
        id="b"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="rotate(42.026 1.868 80.69) scale(54.5206)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#F1E7C1" />
        <stop offset={0.285} stopColor="#F2EAC5" />
        <stop offset={1} stopColor="#E9A23B" />
      </radialGradient>
    </defs>
  </svg>
);

export default FermiLogo3d;
