import logoImg from '../app/image/image.png';

export default function Logo({ size = 80, style = {}, className = '' }) {
  return (
    <img
      src={logoImg.src}
      alt="ATS Logo"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
}
