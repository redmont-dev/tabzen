import { render } from 'preact';
import { App } from './App';
import { applyTheme } from '../theme';

applyTheme();
render(<App />, document.getElementById('app')!);
