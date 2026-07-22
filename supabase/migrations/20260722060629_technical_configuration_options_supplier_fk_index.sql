-- P8A2 follow-up: cover the composite supplier foreign key in FK column order.

CREATE INDEX technical_configuration_options_supplier_dossier_idx
  ON public.technical_configuration_options (supplier_id, dossier_id);
