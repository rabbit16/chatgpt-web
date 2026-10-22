import React from 'react';
import PropTypes from 'prop-types';
import TeX  from '@matejmazur/react-katex';
import '@matejmazur/react-katex/dist/react-katex.css';

function MathRenderer({ formula, block }) {
  return <TeX math={formula} block={block} />;
}

MathRenderer.propTypes = {
  equation: PropTypes.string.isRequired,
  block: PropTypes.bool,
};

MathRenderer.defaultProps = {
  block: false,
};

export default MathRenderer;
