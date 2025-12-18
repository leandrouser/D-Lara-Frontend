import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Embroidery } from './embroidery';

describe('Embroidery', () => {
  let component: Embroidery;
  let fixture: ComponentFixture<Embroidery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Embroidery]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Embroidery);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
