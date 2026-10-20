import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../app/Workspace';

// The preview uses the same Workspace and its CSS as the framework route.
// It does not add another UI implementation or hide the workspace in a frame.
const root = document.getElementById('root');
if (!root) throw new Error('로컬 미리보기의 root 요소가 없습니다.');
createRoot(root).render(<Workspace />);
