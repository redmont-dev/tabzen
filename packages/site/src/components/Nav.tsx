import { Logo } from '@tabzen/shared/logo';
import { CHROME_STORE_URL } from '../config';
import styles from './Nav.module.css';

export function Nav() {
  return (
    <nav class={styles.nav}>
      <Logo size={20} showText textSize={18} />
      <div class={styles.links}>
        <a href="#features">Features</a>
        <a href="#showcase">How it works</a>
        <a href="#reviews">Reviews</a>
      </div>
      <a href={CHROME_STORE_URL} target="_blank" rel="noopener" class={styles.cta}>Add to Chrome</a>
    </nav>
  );
}
