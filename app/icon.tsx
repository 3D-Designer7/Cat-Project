import { ImageResponse } from 'next/og'
 
// Route segment config
export const runtime = 'edge'
 
// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'
 
// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <circle cx="24" cy="24" r="24" fill="#6C63FF"/>
          <g transform="translate(24 24) scale(1.5) translate(-24 -22)">
            <path d="M14 18C14 15 16 13 19 13H29C32 13 34 15 34 18V26C34 29 32 31 29 31H24L20 35V31H19C16 31 14 29 14 26V18Z" fill="white"/>
            <path d="M18 13L20 9L23 13H18Z" fill="white"/>
            <path d="M25 13L28 9L30 13H25Z" fill="white"/>
          </g>
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported icons size metadata
      // config to also set the ImageResponse's width and height.
      ...size,
    }
  )
}
