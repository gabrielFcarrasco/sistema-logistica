interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'sucesso' | 'perigo';
}

export default function Button({ variante = 'primario', children, ...props }: ButtonProps) {
  // Definimos a cor baseada na variante escolhida
  let corFundo = '#2563eb'; // Azul padrão (primario)
  if (variante === 'sucesso') corFundo = '#10b981'; // Verde
  if (variante === 'perigo') corFundo = '#ef4444'; // Vermelho

  return (
    <button 
      {...props} // Repassa propriedades como onClick, type="submit", etc.
      style={{ 
        backgroundColor: corFundo, 
        color: 'white', 
        padding: '10px 20px', 
        borderRadius: '5px', 
        border: 'none', 
        fontWeight: 'bold', 
        cursor: 'pointer',
        ...props.style // Permite adicionar estilos extras se necessário
      }}
    >
      {children} {/* Aqui entra o texto do botão */}
    </button>
  );
}