import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Icon, Progress, Select, TextArea} from '@gravity-ui/uikit';
import {ArrowLeft, ArrowRight, CircleCheckFill} from '@gravity-ui/icons';
import questionnaireData from './questionnaire-data.json';

function questionTitle(question) {
  return question.question || question.metricName;
}

function ProductStep({products, value, onUpdate}) {
  const options = products.map((product) => ({
    value: product.id,
    content: product.name,
  }));
  return (
    <Select
      aria-label="Выберите свой продукт"
      filterable
      options={options}
      placeholder="Начните вводить название"
      popupWidth="fit"
      size="xl"
      value={value ? [value] : []}
      width="max"
      onUpdate={(nextValue) => onUpdate(nextValue[0] || '')}
    />
  );
}

function AnswerStep({answer, placeholder, onSubmit, onUpdate}) {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <TextArea
      controlRef={inputRef}
      minRows={2}
      maxRows={7}
      placeholder={placeholder}
      size="xl"
      value={answer}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onSubmit();
        }
      }}
      onUpdate={onUpdate}
    />
  );
}

export function QuestionnaireApp() {
  const data = questionnaireData;
  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState('');
  const [fullName, setFullName] = useState('');
  const [answers, setAnswers] = useState({});
  const [validation, setValidation] = useState('');
  const [complete, setComplete] = useState(false);

  const product = useMemo(
    () => data?.products.find((item) => item.id === productId),
    [data, productId],
  );
  const questions = product?.questions || [];
  const totalSteps = questions.length + 2;
  const metricIndex = step - 2;
  const question = questions[metricIndex];
  const progress = totalSteps ? Math.round(((step + 1) / totalSteps) * 100) : 0;
  const currentValue = step === 0
    ? productId
    : step === 1
      ? fullName
      : answers[question?.id] || '';

  const title = step === 0
    ? 'Выберите свой продукт'
    : step === 1
      ? 'Введите ваше ФИО'
      : questionTitle(question || {});
  const eyebrow = step < 2
    ? 'Давайте познакомимся'
    : [question?.metricGroup, question?.metricSubgroup].filter(Boolean).join(' · ') || 'Data Driven метрика';

  function validateCurrent() {
    if (String(currentValue).trim()) return true;
    setValidation(step === 0 ? 'Выберите продукт, чтобы продолжить' : 'Заполните поле, чтобы продолжить');
    return false;
  }

  function next(event) {
    event?.preventDefault();
    if (!validateCurrent()) return;
    setValidation('');
    if (step >= totalSteps - 1) {
      setComplete(true);
      return;
    }
    setStep((value) => value + 1);
  }

  function back() {
    setValidation('');
    setStep((value) => Math.max(0, value - 1));
  }

  function updateProduct(value) {
    setProductId(value);
    setAnswers({});
    setValidation('');
  }

  if (complete) {
    return (
      <main className="questionnaire-state questionnaire-complete">
        <Icon data={CircleCheckFill} size={44} />
        <p className="questionnaire-eyebrow">Ответы собраны</p>
        <h1>Спасибо, {fullName.trim()}</h1>
        <p>Черновик опроса по продукту «{product.name}» завершён. Отправка ответов будет подключена на следующем этапе.</p>
        <Button view="outlined" size="l" onClick={() => {setComplete(false); setStep(0);}}>Пройти ещё раз</Button>
      </main>
    );
  }

  return (
    <main className="questionnaire-page">
      <header className="questionnaire-header">
        <div className="questionnaire-brand"><span>DD</span><b>Опрос по продукту</b></div>
        <span className="questionnaire-step">Шаг {step + 1} из {totalSteps}</span>
      </header>
      <Progress className="questionnaire-progress" value={progress} theme="info" size="s" aria-label={`Пройдено ${progress}%`} />

      <form className="questionnaire-form" onSubmit={next}>
        <section className="questionnaire-question" aria-labelledby="question-title">
          <div className="questionnaire-route">
            <span>{String(step + 1).padStart(2, '0')}</span>
            <i aria-hidden="true" />
            <small>{product?.name || 'Ваш продукт'}</small>
          </div>
          <p className="questionnaire-eyebrow">{eyebrow}</p>
          <h1 id="question-title">{title}</h1>
          {question?.metricFooter && <p className="questionnaire-hint">{question.metricFooter}</p>}

          <div className="questionnaire-control">
            {step === 0 && <ProductStep products={data.products} value={productId} onUpdate={updateProduct} />}
            {step === 1 && <AnswerStep answer={fullName} placeholder="Иванов Иван Иванович" onSubmit={next} onUpdate={(value) => {setFullName(value); setValidation('');}} />}
            {step >= 2 && question && (
              <AnswerStep
                key={question.id}
                answer={answers[question.id] || ''}
                placeholder={question.placeholder || 'Введите ответ'}
                onSubmit={next}
                onUpdate={(value) => {setAnswers((current) => ({...current, [question.id]: value})); setValidation('');}}
              />
            )}
            <div className="questionnaire-validation" role="alert" aria-live="polite">{validation}</div>
          </div>
        </section>

        <footer className="questionnaire-actions">
          <Button type="button" view="flat" size="l" disabled={step === 0} onClick={back}>
            <Icon data={ArrowLeft} size={16} />Назад
          </Button>
          <div className="questionnaire-continue">
            <span>или нажмите Enter</span>
            <Button type="submit" view="action" size="xl" disabled={!String(currentValue).trim()}>
              {step === totalSteps - 1 ? 'Завершить' : 'Продолжить'}<Icon data={ArrowRight} size={16} />
            </Button>
          </div>
        </footer>
      </form>
    </main>
  );
}
